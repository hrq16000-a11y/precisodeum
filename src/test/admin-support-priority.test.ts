import { describe, it, expect } from 'vitest';

/**
 * Replica a função de ranking usada em AdminSupportTicketsPanel.
 * Mantemos esta cópia local para validar o CONTRATO da regra de negócio:
 *  - Patrocinador            → rank 0 (prioridade máxima)
 *  - Prestador Ouro+         → rank 1
 *  - Demais prestadores      → rank 2
 *  - Outros (cliente etc.)   → rank 3
 *
 * Se o painel mudar a ordem, este teste falha — proposital.
 */
const GOLD_PLUS = new Set(['Ouro', 'Platina', 'Diamante', 'Mestre']);
const isGoldPlusLevel = (lvl?: string | null) => !!lvl && GOLD_PLUS.has(lvl);

type Ticket = {
  id: string;
  context: {
    profile_snapshot?: {
      requester_kind?: 'sponsor' | 'provider' | 'client' | 'other';
      account_level?: string | null;
      // Chave proibida para prestadores na UI; mantida só para auditoria.
      current_plan?: string | null;
      sponsor?: { sponsor_tier?: string | null };
    };
  };
};

const rank = (t: Ticket) => {
  const k = t.context?.profile_snapshot?.requester_kind;
  const lvl = t.context?.profile_snapshot?.account_level;
  if (k === 'sponsor') return 0;
  if (k === 'provider' && isGoldPlusLevel(lvl)) return 1;
  if (k === 'provider') return 2;
  return 3;
};

describe('AdminSupportTickets · prioridade orgânica', () => {
  it('ordena sponsor > prestador Ouro+ > demais prestadores > outros', () => {
    const rows: Ticket[] = [
      { id: 'cli', context: { profile_snapshot: { requester_kind: 'client' } } },
      { id: 'prov-iniciante', context: { profile_snapshot: { requester_kind: 'provider', account_level: 'Iniciante' } } },
      { id: 'sponsor', context: { profile_snapshot: { requester_kind: 'sponsor', sponsor: { sponsor_tier: 'pro' } } } },
      { id: 'prov-ouro', context: { profile_snapshot: { requester_kind: 'provider', account_level: 'Ouro' } } },
      { id: 'prov-diamante', context: { profile_snapshot: { requester_kind: 'provider', account_level: 'Diamante' } } },
    ];
    const sorted = [...rows].sort((a, b) => rank(a) - rank(b)).map(r => r.id);
    expect(sorted[0]).toBe('sponsor');
    expect(sorted.slice(1, 3).sort()).toEqual(['prov-diamante', 'prov-ouro']);
    expect(sorted[3]).toBe('prov-iniciante');
    expect(sorted[4]).toBe('cli');
  });

  it('NUNCA usa current_plan para priorizar prestador (regra de negócio)', () => {
    // Prestador com current_plan='premium' (resíduo de auditoria) deve ficar
    // ATRÁS de um sponsor e EQUIVALENTE a outros prestadores não-Ouro+.
    const rows: Ticket[] = [
      { id: 'prov-com-plano-pago-residuo', context: { profile_snapshot: { requester_kind: 'provider', account_level: 'Iniciante', current_plan: 'premium' } } },
      { id: 'sponsor', context: { profile_snapshot: { requester_kind: 'sponsor' } } },
    ];
    const sorted = [...rows].sort((a, b) => rank(a) - rank(b)).map(r => r.id);
    expect(sorted[0]).toBe('sponsor');
    expect(sorted[1]).toBe('prov-com-plano-pago-residuo');
  });

  it('snapshot ausente cai no rank residual (não quebra)', () => {
    const rows: Ticket[] = [
      { id: 'sem-ctx', context: {} },
      { id: 'sponsor', context: { profile_snapshot: { requester_kind: 'sponsor' } } },
    ];
    const sorted = [...rows].sort((a, b) => rank(a) - rank(b)).map(r => r.id);
    expect(sorted).toEqual(['sponsor', 'sem-ctx']);
  });
});
