import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface LevelInfo {
  id: string;
  name: string;
  color: string;
  icon: string;
  min_points: number;
  max_points: number | null;
  priority: number;
}

interface EngagementState {
  points: number;
  currentLevel: LevelInfo | null;
  nextLevel: LevelInfo | null;
  progressPct: number;
  pointsToNext: number;
  loading: boolean;
}

/**
 * Hook que lê pontos de engajamento + nível atual + próximo nível em tempo real.
 * Usado pela "Esteira de Dopamina" no wizard e dashboard.
 */
export const useEngagementLevel = () => {
  const { user } = useAuth();
  const [state, setState] = useState<EngagementState>({
    points: 0, currentLevel: null, nextLevel: null,
    progressPct: 0, pointsToNext: 0, loading: true,
  });

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const [{ data: profile }, { data: levels }] = await Promise.all([
      supabase.from('profiles').select('engagement_points, level_id').eq('id', user.id).maybeSingle(),
      supabase.from('gamification_levels').select('*').eq('active', true).order('min_points', { ascending: true }),
    ]);
    const pts = (profile as any)?.engagement_points ?? 0;
    const sorted = (levels ?? []) as LevelInfo[];
    let current: LevelInfo | null = null;
    let next: LevelInfo | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const lvl = sorted[i];
      if (pts >= lvl.min_points && (lvl.max_points == null || pts <= lvl.max_points)) {
        current = lvl;
        next = sorted[i + 1] ?? null;
        break;
      }
    }
    if (!current && sorted.length > 0) current = sorted[0];

    let pct = 100;
    let toNext = 0;
    if (current && next) {
      const span = next.min_points - current.min_points;
      pct = span > 0 ? Math.min(100, Math.round(((pts - current.min_points) / span) * 100)) : 100;
      toNext = Math.max(0, next.min_points - pts);
    }

    setState({
      points: pts,
      currentLevel: current,
      nextLevel: next,
      progressPct: pct,
      pointsToNext: toNext,
      loading: false,
    });
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Realtime: atualiza quando engagement_log muda
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`engagement-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'engagement_log',
        filter: `user_id=eq.${user.id}`,
      }, () => { void refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, refresh]);

  return { ...state, refresh };
};
