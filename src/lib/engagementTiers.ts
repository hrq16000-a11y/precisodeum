/**
 * Engagement tier system — SINGLE SOURCE OF TRUTH é a tabela `gamification_levels`
 * do banco. Esta constante é apenas o espelho client-side dos tiers ATIVOS lá.
 *
 * Escala oficial (5 estações ativas):
 *   Bronze    →   0
 *   Prata     → 120
 *   Ouro      → 260
 *   Diamante  → 400
 *   Mestre    → 500 (teto)
 *
 * Nunca adicione tiers aqui que não existam ativos em `gamification_levels`.
 */

export type EngagementTier =
  | 'bronze'
  | 'prata'
  | 'ouro'
  | 'diamante'
  | 'mestre';

export interface TierConfig {
  tier: EngagementTier;
  label: string;
  minPoints: number;
  borderClass: string;
  badgeClass: string;
  showCrown: boolean;
  isElite: boolean;
}

const TIERS: TierConfig[] = [
  {
    tier: 'mestre',
    label: 'Mestre',
    minPoints: 500,
    borderClass: 'border-amber-400/80 ring-2 ring-amber-300/50 shadow-[0_0_24px_-4px_rgba(245,158,11,0.45)]',
    badgeClass: 'bg-gradient-to-r from-amber-400 to-red-500 text-white',
    showCrown: true,
    isElite: true,
  },
  {
    tier: 'diamante',
    label: 'Diamante',
    minPoints: 400,
    borderClass: 'border-purple-400/70 ring-2 ring-purple-300/40 shadow-[0_0_18px_-4px_rgba(139,92,246,0.4)]',
    badgeClass: 'bg-purple-100 text-purple-800',
    showCrown: true,
    isElite: true,
  },
  {
    tier: 'ouro',
    label: 'Ouro',
    minPoints: 260,
    borderClass: 'border-amber-400/60 ring-1 ring-amber-300/30 shadow-[0_0_14px_-4px_rgba(245,158,11,0.35)]',
    badgeClass: 'bg-amber-100 text-amber-800',
    showCrown: false,
    isElite: true,
  },
  {
    tier: 'prata',
    label: 'Prata',
    minPoints: 120,
    borderClass: 'border-slate-300/60 ring-1 ring-slate-200/30',
    badgeClass: 'bg-slate-100 text-slate-700',
    showCrown: false,
    isElite: false,
  },
  {
    tier: 'bronze',
    label: 'Bronze',
    minPoints: 0,
    borderClass: 'border-orange-300/50',
    badgeClass: 'bg-orange-100 text-orange-700',
    showCrown: false,
    isElite: false,
  },
];

export const getEngagementTier = (points: number): TierConfig => {
  for (const t of TIERS) {
    if (points >= t.minPoints) return t;
  }
  return TIERS[TIERS.length - 1];
};

export const ALL_TIERS = TIERS;
