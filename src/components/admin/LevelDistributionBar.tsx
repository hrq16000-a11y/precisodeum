import { useMemo } from 'react';
import { Crown, Trophy } from 'lucide-react';
import { ALL_TIERS, getEngagementTier, type EngagementTier } from '@/lib/engagementTiers';

interface Props {
  profiles: Array<{ engagement_points?: number | null }>;
}

/**
 * Compact stat strip showing how many users are in each gamification tier.
 * Computed client-side from already-loaded profiles for instant updates
 * after admin point adjustments.
 */
const LevelDistributionBar = ({ profiles }: Props) => {
  const counts = useMemo(() => {
    const map: Record<EngagementTier, number> = {
      iniciante: 0, entusiasta: 0, engajado: 0,
      ouro: 0, platina: 0, diamante: 0, mestre: 0,
    };
    profiles.forEach(p => {
      const tier = getEngagementTier(p.engagement_points || 0);
      map[tier.tier]++;
    });
    return map;
  }, [profiles]);

  // Display from highest tier to lowest
  const ordered = [...ALL_TIERS].sort((a, b) => b.minPoints - a.minPoints);

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-bold text-foreground">Distribuição por Nível</h3>
        <span className="text-xs text-muted-foreground">— atualiza ao vivo conforme ajustes de pontos</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {ordered.map(t => {
          const count = counts[t.tier];
          const isElite = t.isElite;
          return (
            <div
              key={t.tier}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${t.badgeClass} ${isElite ? 'ring-1 ring-current/20' : ''}`}
              title={`A partir de ${t.minPoints} pontos`}
            >
              {t.showCrown && <Crown className="h-3 w-3" />}
              <span>{t.label}</span>
              <span className="rounded-full bg-white/40 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LevelDistributionBar;
