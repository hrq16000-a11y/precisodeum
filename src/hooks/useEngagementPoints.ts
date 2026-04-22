import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { resolveGamificationMultiplier, scaleGamificationPoints } from '@/lib/gamification';

/**
 * Fetches engagement_points for a list of user IDs (batch).
 * Returns a map: userId -> points.
 */
export const useEngagementPointsBatch = (userIds: string[]) => {
  const multiplier = resolveGamificationMultiplier(useSettingValue('gamification_multiplier'));
  return useQuery({
    queryKey: ['engagement-points-batch', userIds.sort().join(','), multiplier],
    queryFn: async () => {
      if (userIds.length === 0) return {} as Record<string, number>;
      const { data } = await supabase
        .from('profiles')
        .select('id, engagement_points')
        .in('id', userIds);
      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => { map[p.id] = scaleGamificationPoints(p.engagement_points || 0, multiplier); });
      return map;
    },
    enabled: userIds.length > 0,
    staleTime: 30_000,
  });
};

/**
 * Fetches engagement_points for a single provider by user_id.
 */
export const useEngagementPoints = (userId?: string) => {
  const multiplier = resolveGamificationMultiplier(useSettingValue('gamification_multiplier'));
  return useQuery({
    queryKey: ['engagement-points', userId, multiplier],
    queryFn: async () => {
      if (!userId) return 0;
      const { data } = await supabase
        .from('profiles')
        .select('engagement_points')
        .eq('id', userId)
        .single();
      return scaleGamificationPoints((data as any)?.engagement_points || 0, multiplier);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
};
