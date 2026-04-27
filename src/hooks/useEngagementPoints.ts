/**
 * useEngagementPoints — leitura reativa dos pontos de engajamento (profiles.engagement_points).
 * Retorna no formato { data } compatível com react-query para ergonomia.
 *
 * Faz polling leve (a cada 4s) enquanto o componente está montado, suficiente
 * para refletir os incrementos disparados pelos triggers do banco.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useEngagementPoints(userId: string | null | undefined): { data: number } {
  const [data, setData] = useState<number>(0);

  useEffect(() => {
    if (!userId) { setData(0); return; }
    let active = true;

    const fetchPoints = async () => {
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
    const id = window.setInterval(fetchPoints, 4000);
    return () => { active = false; window.clearInterval(id); };
  }, [userId]);

  return { data };
}

/** Versão "raw" — retorna apenas o número, usado pelo HUD do wizard unificado. */
export function useEngagementPointsValue(userId: string | null | undefined): number {
  return useEngagementPoints(userId).data;
}
