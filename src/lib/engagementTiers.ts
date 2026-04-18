/**
 * Engagement tier system aligned with the 7-level gamification ladder.
 * Names match gamification_levels rows in the database:
 * Iniciante (0) → Entusiasta (20) → Engajado (50) → Ouro (100) →
 * Platina (200) → Diamante (400) → Mestre (700)
 */

export type EngagementTier =
  | 'iniciante'
  | 'entusiasta'
  | 'engajado'
  | 'ouro'
  | 'platina'
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
    minPoints: 5000,
    borderClass: 'border-amber-400/80 ring-2 ring-amber-300/50 shadow-[0_0_24px_-4px_rgba(245,158,11,0.45)]',
    badgeClass: 'bg-gradient-to-r from-amber-400 to-red-500 text-white',
    showCrown: true,
    isElite: true,
  },
  {
    tier: 'diamante',
    label: 'Diamante',
    minPoints: 3000,
    borderClass: 'border-purple-400/70 ring-2 ring-purple-300/40 shadow-[0_0_18px_-4px_rgba(139,92,246,0.4)]',
    badgeClass: 'bg-purple-100 text-purple-800',
    showCrown: true,
    isElite: true,
  },
  {
    tier: 'platina',
    label: 'Platina',
    minPoints: 1500,
    borderClass: 'border-cyan-400/60 ring-1 ring-cyan-300/30',
    badgeClass: 'bg-cyan-100 text-cyan-800',
    showCrown: false,
    isElite: true,
  },
  {
    tier: 'ouro',
    label: 'Ouro',
    minPoints: 700,
    borderClass: 'border-amber-400/60 ring-1 ring-amber-300/30 shadow-[0_0_14px_-4px_rgba(245,158,11,0.35)]',
    badgeClass: 'bg-amber-100 text-amber-800',
    showCrown: false,
    isElite: true,
  },
  {
    tier: 'engajado',
    label: 'Engajado',
    minPoints: 300,
    borderClass: 'border-blue-300/50 ring-1 ring-blue-200/20',
    badgeClass: 'bg-blue-100 text-blue-700',
    showCrown: false,
    isElite: false,
  },
  {
    tier: 'entusiasta',
    label: 'Entusiasta',
    minPoints: 100,
    borderClass: 'border-green-300/50',
    badgeClass: 'bg-green-100 text-green-700',
    showCrown: false,
    isElite: false,
  },
  {
    tier: 'iniciante',
    label: 'Iniciante',
    minPoints: 0,
    borderClass: 'border-border',
    badgeClass: 'bg-slate-100 text-slate-700',
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
