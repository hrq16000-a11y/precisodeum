import { useEffect, useMemo, useState } from 'react';
import { Crown, Trophy } from 'lucide-react';
import { ALL_TIERS, getEngagementTier, type EngagementTier } from '@/lib/engagementTiers';
import { IconRenderer } from '@/components/ui/IconRenderer';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  profiles: Array<{ engagement_points?: number | null }>;
}

interface LevelMeta { name: string; icon: string; color: string; min_points: number; }

/**
 * Compact stat strip showing how many users are in each gamification tier.
 * Pulls live icon + color from gamification_levels so admin edits reflect instantly.
 */
const LevelDistributionBar = ({ profiles }: Props) => {
  const [levels, setLevels] = useState<LevelMeta[]>([]);

  useEffect(() => {
    supabase
      .from('gamification_levels')
      .select('name,icon,color,min_points')
      .eq('active', true)
      .then(({ data }) => setLevels((data as any) || []));
  }, []);

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

  const ordered = [...ALL_TIERS].sort((a, b) => b.minPoints - a.minPoints);
  const metaByLabel = (label: string) =>
    levels.find(l => l.name.toLowerCase() === label.toLowerCase());

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
          const meta = metaByLabel(t.label);
          return (
            <div
              key={t.tier}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${t.badgeClass} ${t.isElite ? 'ring-1 ring-current/20' : ''}`}
              title={`A partir de ${t.minPoints} pontos`}
            >
              {t.showCrown && <Crown className="h-3 w-3" />}
              {meta?.icon && (
                <IconRenderer name={meta.icon} size={12} color={meta.color} glow={t.isElite} />
              )}
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
