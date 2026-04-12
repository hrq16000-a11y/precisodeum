/**
 * Engagement tier system for visual hierarchy on provider cards.
 * Points are calculated server-side via recalculate_engagement_points().
 */

export type EngagementTier = 'basic' | 'engaged' | 'featured';

export interface TierConfig {
  tier: EngagementTier;
  label: string;
  minPoints: number;
  borderClass: string;
  badgeClass: string;
  icon: string; // emoji fallback
  showCrown: boolean;
}

const TIERS: TierConfig[] = [
  {
    tier: 'featured',
    label: 'Destaque',
    minPoints: 70,
    borderClass: 'border-accent ring-2 ring-accent/30',
    badgeClass: 'bg-gradient-to-r from-accent to-amber-400 text-white',
    icon: '👑',
    showCrown: true,
  },
  {
    tier: 'engaged',
    label: 'Engajado',
    minPoints: 30,
    borderClass: 'border-primary/50 ring-1 ring-primary/20',
    badgeClass: 'bg-primary/10 text-primary',
    icon: '⭐',
    showCrown: false,
  },
  {
    tier: 'basic',
    label: 'Básico',
    minPoints: 0,
    borderClass: 'border-border',
    badgeClass: 'bg-muted text-muted-foreground',
    icon: '',
    showCrown: false,
  },
];

export const getEngagementTier = (points: number): TierConfig => {
  for (const t of TIERS) {
    if (points >= t.minPoints) return t;
  }
  return TIERS[TIERS.length - 1];
};

export const ALL_TIERS = TIERS;
