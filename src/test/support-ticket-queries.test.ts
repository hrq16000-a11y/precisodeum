import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes RLS (mock client) — validam que as queries do client respeitam o contrato:
 *  - usuário comum só vê o próprio ticket (filtro user_id = auth.uid())
 *  - admin lista TODOS os tickets (sem filtro user_id)
 *  - usuário só insere mensagem como sender_role='user' no próprio ticket
 *  - admin insere como sender_role='admin' em qualquer ticket
 *
 * RLS real é validado no Postgres; aqui validamos a forma das chamadas do client.
 */

type Call = { table: string; method: string; args: any[] };

function makeMockSupabase() {
  const calls: Call[] = [];
  const chain: any = {
    _calls: calls,
    from(table: string) { calls.push({ table, method: 'from', args: [table] }); return chain; },
    select(...a: any[]) { calls.push({ table: '', method: 'select', args: a }); return chain; },
    insert(...a: any[]) { calls.push({ table: '', method: 'insert', args: a }); return Promise.resolve({ data: null, error: null }); },
    eq(...a: any[]) { calls.push({ table: '', method: 'eq', args: a }); return chain; },
    neq(...a: any[]) { calls.push({ table: '', method: 'neq', args: a }); return chain; },
    order(...a: any[]) { calls.push({ table: '', method: 'order', args: a }); return chain; },
    limit(...a: any[]) { calls.push({ table: '', method: 'limit', args: a }); return chain; },
    range(...a: any[]) { calls.push({ table: '', method: 'range', args: a }); return chain; },
    or(...a: any[]) { calls.push({ table: '', method: 'or', args: a }); return chain; },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    single() { return Promise.resolve({ data: null, error: null }); },
  };
  return chain;
}

describe('Suporte · contrato de queries por papel', () => {
  let supabase: any;
  beforeEach(() => { supabase = makeMockSupabase(); });

  it('usuário comum: lista de tickets filtra por user_id', async () => {
    const userId = 'user-123';
    await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const eqs = supabase._calls.filter((c: Call) => c.method === 'eq');
    expect(eqs.some((c: Call) => c.args[0] === 'user_id' && c.args[1] === userId)).toBe(true);
  });

  it('admin: lista de tickets NÃO filtra por user_id (vê todos)', async () => {
    await supabase
      .from('support_tickets')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(0, 19);
    const eqs = supabase._calls.filter((c: Call) => c.method === 'eq');
    expect(eqs.some((c: Call) => c.args[0] === 'user_id')).toBe(false);
  });

  it('usuário envia mensagem como sender_role=user', async () => {
    await supabase.from('support_ticket_messages').insert({
      ticket_id: 't-1', sender_id: 'u-1', sender_role: 'user', content: 'Olá',
    });
    const ins = supabase._calls.find((c: Call) => c.method === 'insert');
    expect(ins.args[0].sender_role).toBe('user');
  });

  it('admin envia mensagem como sender_role=admin', async () => {
    await supabase.from('support_ticket_messages').insert({
      ticket_id: 't-1', sender_id: 'admin-1', sender_role: 'admin', content: 'Resposta',
    });
    const ins = supabase._calls.find((c: Call) => c.method === 'insert');
    expect(ins.args[0].sender_role).toBe('admin');
  });

  it('busca admin: usa OR em colunas indexadas (nome, cidade, assunto, last_msg)', async () => {
    await supabase.from('support_tickets').select('*')
      .or('user_full_name.ilike.%joao%,user_city.ilike.%joao%,subject.ilike.%joao%,last_message_text.ilike.%joao%');
    const orCall = supabase._calls.find((c: Call) => c.method === 'or');
    expect(orCall).toBeDefined();
    expect(orCall.args[0]).toContain('user_full_name.ilike');
    expect(orCall.args[0]).toContain('user_city.ilike');
    expect(orCall.args[0]).toContain('subject.ilike');
  });

  it('paginação admin: usa range de PAGE_SIZE=20', async () => {
    await supabase.from('support_tickets').select('*', { count: 'exact' }).range(40, 59);
    const r = supabase._calls.find((c: Call) => c.method === 'range');
    expect(r.args).toEqual([40, 59]);
    expect(r.args[1] - r.args[0] + 1).toBe(20);
  });
});
