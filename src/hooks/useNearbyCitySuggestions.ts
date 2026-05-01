/**
 * useNearbyCitySuggestions — busca cidades próximas a uma cidade-base via RPC
 * suggest_nearby_cities (Haversine no Postgres). Retorna ordenadas por
 * distância e classificadas em "near" (≤15 km), "mid" (≤50 km) e "far" (≤100 km).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NearbyCitySuggestion {
  id: string;
  name: string;
  state_uf: string;
  distance_km: number;
  bucket: 'near' | 'mid' | 'far';
}

interface Args {
  baseCity: string | null | undefined;
  baseState: string | null | undefined;
  maxKm?: number;
  limit?: number;
  enabled?: boolean;
}

export function useNearbyCitySuggestions({
  baseCity,
  baseState,
  maxKm = 100,
  limit = 30,
  enabled = true,
}: Args) {
  const [data, setData] = useState<NearbyCitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !baseCity) {
      setData([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (supabase.rpc as any)('suggest_nearby_cities', {
      _base_city: baseCity,
      _base_state: baseState || '',
      _max_km: maxKm,
      _limit: limit,
    })
      .then((res: any) => {
        if (cancelled) return;
        if (res.error) {
          setError(res.error.message || 'Falha ao sugerir cidades');
          setData([]);
        } else {
          const rows = (res.data || []) as NearbyCitySuggestion[];
          // Garante ordem por distance_km (já vem ordenado, mas reforça).
          rows.sort((a, b) => a.distance_km - b.distance_km);
          setData(rows);
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message || 'Erro de rede');
        setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [baseCity, baseState, maxKm, limit, enabled]);

  return { data, loading, error };
}
