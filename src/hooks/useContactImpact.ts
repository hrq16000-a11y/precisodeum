import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ContactImpact {
  total_views: number;
  whatsapp_clicks: number;
  phone_clicks: number;
  unique_visitors: number;
}

/**
 * Lê quantas pessoas viram/contactaram o profissional nas últimas 24h.
 * Usa a RPC `get_contact_impact_24h` (criada no Lote 1 do Motor de Visibilidade).
 */
export function useContactImpact() {
  const { user } = useAuth();

  return useQuery<ContactImpact>({
    queryKey: ['contact-impact-24h', user?.id],
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_contact_impact_24h', {
        _user_id: user!.id,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        total_views: Number(row?.total_views ?? 0),
        whatsapp_clicks: Number(row?.whatsapp_clicks ?? 0),
        phone_clicks: Number(row?.phone_clicks ?? 0),
        unique_visitors: Number(row?.unique_visitors ?? 0),
      };
    },
  });
}
