import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthIdentity } from '@/hooks/useAuth';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { resolveGamificationMultiplier, scaleGamificationPoints } from '@/lib/gamification';
import { acquireChannel, releaseChannel } from '@/lib/realtimeRegistry';

/**
 * Um único canal atende todas as instâncias do hook para o mesmo usuário.
 * Os listeners locais preservam o refresh individual sem tentar adicionar
 * callbacks a um canal que já passou por subscribe().
 */
const refreshListenersByUser = new Map<string, Set<() => void>>();

function refreshEngagementConsumers(userId: string): void {
  refreshListenersByUser.get(userId)?.forEach((listener) => listener());
}

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
  const { user } = useAuthIdentity();
  const multiplier = resolveGamificationMultiplier(useSettingValue('gamification_multiplier'));
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
    const rawPts = (profile as any)?.engagement_points ?? 0;
    const pts = scaleGamificationPoints(rawPts, multiplier);
    const sorted = ((levels ?? []) as LevelInfo[]).map((level) => ({
      ...level,
      min_points: scaleGamificationPoints(level.min_points, multiplier),
      max_points: level.max_points == null ? null : scaleGamificationPoints(level.max_points, multiplier),
    }));
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
  }, [multiplier, user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Realtime: atualiza quando engagement_log muda
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const channelName = `engagement-${userId}`;
    const listener = () => { void refresh(); };
    const listeners = refreshListenersByUser.get(userId) ?? new Set<() => void>();
    listeners.add(listener);
    refreshListenersByUser.set(userId, listeners);

    acquireChannel(channelName, {
      setup: (channel) => channel.on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'engagement_log',
        filter: `user_id=eq.${userId}`,
      }, () => refreshEngagementConsumers(userId)),
    });

    return () => {
      const current = refreshListenersByUser.get(userId);
      current?.delete(listener);
      if (current?.size === 0) refreshListenersByUser.delete(userId);
      releaseChannel(channelName);
    };
  }, [user?.id, refresh]);

  return { ...state, refresh };
};
