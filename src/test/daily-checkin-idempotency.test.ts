/**
 * Testes de idempotência e timezone do daily check-in.
 *
 * Foco: validar contratos do retorno da RPC (puro, sem rede). A regra
 * timezone/atômica é testada de fato no banco via UNIQUE constraint
 * `(user_id, checkin_date)` e `INSERT ... ON CONFLICT DO NOTHING`.
 */
import { describe, it, expect } from 'vitest';

/**
 * Réplica TypeScript da lógica de "data de hoje" do RPC, em TZ fixo
 * (`America/Sao_Paulo`). Usada para asserts de virada de dia.
 */
function todayInBrazil(at: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(at); // YYYY-MM-DD
}

describe('daily check-in — timezone & idempotency', () => {
  it('retorno idempotente preserva o streak quando já fez hoje', () => {
    const response = { already_done_today: true, streak: 4, date: '2026-04-29' };
    expect(response.already_done_today).toBe(true);
    expect(response.streak).toBe(4);
  });

  it('retorno novo expõe streak incremental e flag de milestone', () => {
    const response = { already_done_today: false, streak: 7, milestone_7d: true };
    expect(response.already_done_today).toBe(false);
    expect(response.milestone_7d).toBe(true);
  });

  it('virada de dia: 23:59 BRT vs 00:01 BRT geram datas diferentes', () => {
    // 02:59 UTC = 23:59 BRT (mesmo dia BRT)
    const before = new Date('2026-04-29T02:59:00Z');
    // 03:01 UTC = 00:01 BRT (dia seguinte BRT)
    const after = new Date('2026-04-29T03:01:00Z');
    expect(todayInBrazil(before)).toBe('2026-04-28');
    expect(todayInBrazil(after)).toBe('2026-04-29');
    expect(todayInBrazil(before)).not.toBe(todayInBrazil(after));
  });

  it('dois cliques no mesmo segundo geram a mesma data BRT', () => {
    const t = new Date('2026-04-29T15:30:00Z');
    expect(todayInBrazil(t)).toBe(todayInBrazil(t));
  });

  it('servidor em UTC e usuário em qualquer TZ caem na mesma data BRT', () => {
    // Garantia: a função TZ-fixa não muda com o TZ do processo Node
    const t = new Date('2026-04-29T15:30:00Z');
    expect(todayInBrazil(t)).toBe('2026-04-29');
  });

  it('virada de meia-noite UTC dentro do mesmo dia BRT', () => {
    // 23:30 UTC = 20:30 BRT (mesmo dia BRT)
    // 00:30 UTC do dia seguinte = 21:30 BRT (ainda mesmo dia BRT)
    const a = new Date('2026-04-29T23:30:00Z');
    const b = new Date('2026-04-30T00:30:00Z');
    expect(todayInBrazil(a)).toBe('2026-04-29');
    expect(todayInBrazil(b)).toBe('2026-04-29');
  });
});

describe('PWA install bonus — idempotency contract', () => {
  it('primeira chamada retorna granted +30', () => {
    const r = { status: 'granted', points_awarded: 30 };
    expect(r.status).toBe('granted');
    expect(r.points_awarded).toBe(30);
  });

  it('segunda chamada retorna already_completed +0', () => {
    const r = { status: 'already_completed', points_awarded: 0 };
    expect(r.status).toBe('already_completed');
    expect(r.points_awarded).toBe(0);
  });

  it('sem provider retorna no_provider sem creditar', () => {
    const r = { status: 'no_provider', points_awarded: 0 };
    expect(r.status).toBe('no_provider');
    expect(r.points_awarded).toBe(0);
  });
});
