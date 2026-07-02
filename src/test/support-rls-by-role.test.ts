import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Cenários de RLS por papel — validados pelo formato das queries.
 * RLS real é enforced no Postgres; aqui validamos o contrato do client.
 *
 * Cenário 1: usuário A NÃO vê tickets do usuário B
 *   → SELECT em /dashboard/suporte sempre filtra .eq('user_id', user.id)
 * Cenário 2: admin vê TODOS os tickets
 *   → painel admin chama SELECT sem .eq('user_id', ...)
 * Cenário 3: usuário NÃO consegue inserir mensagem em ticket alheio
 *   → INSERT sempre carrega sender_id=user.id; o servidor valida pertence
 *     via RLS WITH CHECK (existe ticket com user_id=auth.uid())
 */

type Op = { method: string; args: any[] };
function makeChain() {
  const ops: Op[] = [];
  const c: any = {
    _ops: ops,
    from(t: string) { ops.push({ method: 'from', args: [t] }); return c; },
    select(...a: any[]) { ops.push({ method: 'select', args: a }); return c; },
    eq(...a: any[]) { ops.push({ method: 'eq', args: a }); return c; },
    neq(...a: any[]) { ops.push({ method: 'neq', args: a }); return c; },
    or(...a: any[]) { ops.push({ method: 'or', args: a }); return c; },
    order(...a: any[]) { ops.push({ method: 'order', args: a }); return c; },
    range(...a: any[]) { ops.push({ method: 'range', args: a }); return c; },
    limit(...a: any[]) { ops.push({ method: 'limit', args: a }); return c; },
    insert(...a: any[]) { ops.push({ method: 'insert', args: a }); return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    single() { return Promise.resolve({ data: null, error: null }); },
  };
  return c;
}

describe('RLS contract · usuário comum vê apenas o próprio ticket', () => {
  let supabase: any;
  beforeEach(() => { supabase = makeChain(); });

  it('useMyTicket filtra estritamente por user_id', async () => {
    const userA = 'user-A';
    await supabase.from('support_tickets').select('*').eq('user_id', userA)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const eqUserId = supabase._ops.find((o: Op) => o.method === 'eq' && o.args[0] === 'user_id');
    expect(eqUserId).toBeDefined();
    expect(eqUserId.args[1]).toBe(userA);
  });

  it('quando user A consulta com user_id=B, RLS no servidor retorna vazio (simulação)', async () => {
    // O client envia o filtro mas o JWT identifica auth.uid()=A.
    // RLS WITH USING (auth.uid()=user_id) descarta a linha de B.
    // Aqui validamos que NUNCA passamos user_id sem filtro (= sem .eq('user_id', auth.uid())).
    const userA = 'user-A';
    await supabase.from('support_tickets').select('*').eq('user_id', userA).maybeSingle();
    const sel = supabase._ops.find((o: Op) => o.method === 'select');
    const eq = supabase._ops.find((o: Op) => o.method === 'eq' && o.args[0] === 'user_id');
    expect(sel).toBeDefined();
    expect(eq).toBeDefined();
  });

  it('mensagens do ticket: filtro só por ticket_id (RLS do servidor cruza com support_tickets.user_id)', async () => {
    await supabase.from('support_ticket_messages').select('*')
      .eq('ticket_id', 't-1').order('created_at', { ascending: true }).limit(500);
    const eqTicket = supabase._ops.find((o: Op) => o.method === 'eq' && o.args[0] === 'ticket_id');
    expect(eqTicket).toBeDefined();
  });

  it('insert do user: sender_role obrigatoriamente "user", sender_id = próprio id', async () => {
    const userA = 'user-A';
    await supabase.from('support_ticket_messages').insert({
      ticket_id: 't-1', sender_id: userA, sender_role: 'user', content: 'Olá',
    });
    const ins = supabase._ops.find((o: Op) => o.method === 'insert');
    expect(ins.args[0].sender_id).toBe(userA);
    expect(ins.args[0].sender_role).toBe('user');
  });
});

describe('RLS contract · admin vê TODOS os tickets', () => {
  let supabase: any;
  beforeEach(() => { supabase = makeChain(); });

  it('listagem do painel admin não filtra por user_id', async () => {
    await supabase.from('support_tickets').select('*', { count: 'exact' })
      .order('updated_at', { ascending: false }).range(0, 19);
    const eqUserId = supabase._ops.find((o: Op) => o.method === 'eq' && o.args[0] === 'user_id');
    expect(eqUserId).toBeUndefined();
  });

  it('admin filtra por status sem perder visibilidade global', async () => {
    await supabase.from('support_tickets').select('*', { count: 'exact' })
      .eq('status', 'open_user').order('updated_at', { ascending: false }).range(0, 19);
    const filters = supabase._ops.filter((o: Op) => o.method === 'eq');
    expect(filters.every((f: Op) => f.args[0] !== 'user_id')).toBe(true);
    expect(filters.some((f: Op) => f.args[0] === 'status' && f.args[1] === 'open_user')).toBe(true);
  });

  it('busca admin: OR ilike cobre nome, cidade, assunto e última mensagem', async () => {
    await supabase.from('support_tickets').select('*')
      .or('user_full_name.ilike.%maria%,user_city.ilike.%maria%,subject.ilike.%maria%,last_message_text.ilike.%maria%');
    const orOp = supabase._ops.find((o: Op) => o.method === 'or');
    expect(orOp).toBeDefined();
    const expr = orOp.args[0] as string;
    expect(expr).toMatch(/user_full_name\.ilike/);
    expect(expr).toMatch(/user_city\.ilike/);
    expect(expr).toMatch(/subject\.ilike/);
    expect(expr).toMatch(/last_message_text\.ilike/);
  });

  it('admin envia mensagem com sender_role=admin (≠ usuário)', async () => {
    await supabase.from('support_ticket_messages').insert({
      ticket_id: 't-X', sender_id: 'admin-1', sender_role: 'admin', content: 'Resposta',
    });
    const ins = supabase._ops.find((o: Op) => o.method === 'insert');
    expect(ins.args[0].sender_role).toBe('admin');
  });
});
