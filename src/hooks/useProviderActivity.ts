import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProviderActivitySignals {
  working_now: boolean;
  active_today: boolean;
  has_daily_post?: boolean;
  closed_lead_24h?: boolean;
  last_signal_at?: string | null;
}

/**
 * Sinais de atividade do profissional para badges de "Frescor":
 *  - working_now: heartbeat ativo nos últimos 5min
 *  - active_today: postou Obra do Dia hoje OU fechou lead em 24h OU está online
 *
 * Cache de 90s para evitar carga em listagens.
 */
export function useProviderActivity(userId?: string | null) {
  return useQuery({
    queryKey: ['provider-activity', userId],
    enabled: !!userId,
    staleTime: 90_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<ProviderActivitySignals> => {
      const { data, error } = await supabase.rpc(
        'get_provider_activity_signals' as any,
        { _user_id: userId }
      );
      if (error) throw error;
      return (data as unknown as ProviderActivitySignals) || {
        working_now: false,
        active_today: false,
      };
    },
  });
}
