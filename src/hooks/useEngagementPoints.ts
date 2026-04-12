import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches engagement_points for a list of user IDs (batch).
 * Returns a map: userId -> points.
 */
export const useEngagementPointsBatch = (userIds: string[]) => {
  return useQuery({
    queryKey: ['engagement-points-batch', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return {} as Record<string, number>;
      const { data } = await supabase
        .from('profiles')
        .select('id, engagement_points')
        .in('id', userIds);
      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.engagement_points || 0; });
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
  return useQuery({
    queryKey: ['engagement-points', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { data } = await supabase
        .from('profiles')
        .select('engagement_points')
        .eq('id', userId)
        .single();
      return (data as any)?.engagement_points || 0;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
};
