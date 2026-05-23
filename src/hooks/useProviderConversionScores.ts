import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { bucketize, type ConversionBucket, type ProviderConversionStats } from '@/lib/conversionSignals';

export interface ProviderConversionMap {
  [providerId: string]: ProviderConversionStats & { bucket: ConversionBucket };
}

/**
 * Busca stats de conversão por provider em lote (uma chamada para a lista).
 * Cache 5 min — sinais agregam lentamente, não exigem realtime.
 */
export function useProviderConversionScores(providerIds: string[], days = 30) {
  const ids = (providerIds || []).filter(Boolean);
  const key = ids.slice().sort().join(',');
  return useQuery({
    queryKey: ['provider-conversion-scores', key, days],
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<ProviderConversionMap> => {
      const { data, error } = await supabase.rpc('get_provider_conversion_stats' as any, {
        _provider_ids: ids,
        _days: days,
      } as any);
      if (error) throw error;
      const map: ProviderConversionMap = {};
      (data as any[] | null)?.forEach((row) => {
        const stats: ProviderConversionStats = {
          provider_id: row.provider_id,
          profile_views: Number(row.profile_views) || 0,
          whatsapp_clicks: Number(row.whatsapp_clicks) || 0,
          phone_clicks: Number(row.phone_clicks) || 0,
          lead_submits: Number(row.lead_submits) || 0,
          ctr_view_to_contact: Number(row.ctr_view_to_contact) || 0,
          lead_rate: Number(row.lead_rate) || 0,
        };
        map[row.provider_id] = { ...stats, bucket: bucketize(stats) };
      });
      return map;
    },
  });
}
