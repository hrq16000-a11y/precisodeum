import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Conjunto de user_ids dos profissionais com sinal de "Ativo Hoje"
 * (postou Obra do Dia ou fechou lead nas últimas 24h).
 *
 * Cache 90s para alimentar o filtro do /buscar e do mapa.
 */
export function useActiveTodayProviders(): Set<string> {
  const { data } = useQuery({
    queryKey: ['active-today-providers'],
    staleTime: 90_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_today_providers' as any);
      if (error) throw error;
      return (data as Array<{ user_id: string }>) || [];
    },
  });

  return useMemo(() => new Set((data || []).map((r) => r.user_id)), [data]);
}
