import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type MaturityTier = 'novato' | 'explorador' | 'ativo' | 'veterano';

export interface MaturityData {
  tier: MaturityTier;
  score: number;
  visits: number;
  engagement: number;
  checkins: number;
  onboarding_step: number;
  onboarding_completed: boolean;
}

const TIER_RANK: Record<MaturityTier, number> = {
  novato: 0,
  explorador: 1,
  ativo: 2,
  veterano: 3,
};

/**
 * Lê o tier de maturidade do usuário a partir da RPC `get_user_maturity_tier`,
 * que combina visits_count + engagement_points + daily_checkins + onboarding.
 *
 * Use `isAtLeast(tier)` para gating de widgets:
 *   const { isAtLeast } = useMaturityTier();
 *   if (isAtLeast('ativo')) <UpsellCta />
 */
export function useMaturityTier() {
  const { user } = useAuth();
  const [data, setData] = useState<MaturityData | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const { data: rpc, error } = await supabase.rpc('get_user_maturity_tier', {
        _user_id: user.id,
      });
      if (!error && rpc) setData(rpc as unknown as MaturityData);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const isAtLeast = useCallback(
    (tier: MaturityTier) => {
      if (!data) return false;
      return TIER_RANK[data.tier] >= TIER_RANK[tier];
    },
    [data]
  );

  return {
    data,
    tier: data?.tier ?? 'novato',
    score: data?.score ?? 0,
    loading,
    isAtLeast,
    refetch,
  };
}
