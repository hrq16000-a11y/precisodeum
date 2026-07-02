/**
 * useEngagementPoints — leitura reativa dos pontos de engajamento (profiles.engagement_points).
 * Retorna no formato { data } compatível com react-query para ergonomia.
 *
 * Polling: 60s (era 4s — gerava DDoS interno em produção). Pausado quando a
 * aba não está visível (`document.visibilityState !== 'visible'`) e refetch
 * imediato no `visibilitychange` para refletir incrementos sem latência.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const POLL_MS = 60_000;

export function useEngagementPoints(userId: string | null | undefined): { data: number } {
  const [data, setData] = useState<number>(0);

  useEffect(() => {
    if (!userId) { setData(0); return; }
    let active = true;

    const fetchPoints = async () => {
      // Early return: aba oculta → não bate no banco.
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const { data: row } = await supabase
        .from('profiles')
        .select('engagement_points')
        .eq('id', userId)
        .maybeSingle();
      if (!active) return;
      const v = Number((row as any)?.engagement_points ?? 0);
      if (!Number.isNaN(v)) setData(v);
    };

    void fetchPoints();
    const id = window.setInterval(fetchPoints, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchPoints();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId]);

  return { data };
}

/** Versão "raw" — retorna apenas o número, usado pelo HUD do wizard unificado. */
export function useEngagementPointsValue(userId: string | null | undefined): number {
  return useEngagementPoints(userId).data;
}
