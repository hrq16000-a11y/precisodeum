/**
 * useEngagementPoints — leitura reativa dos pontos reais (profiles.engagement_points)
 * para alimentar o PointsHud global do wizard unificado.
 *
 * Faz polling leve (a cada 2s) enquanto o componente está montado, suficiente
 * para refletir os incrementos disparados pelos triggers do banco quando o
 * usuário avança nas fases V2/extras (BetModeShell já mantém seu próprio
 * placar realtime).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useEngagementPoints(userId: string | null | undefined) {
  const [points, setPoints] = useState<number>(0);

  useEffect(() => {
    if (!userId) { setPoints(0); return; }
    let active = true;

    const fetchPoints = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('engagement_points')
        .eq('id', userId)
        .maybeSingle();
      if (!active) return;
      const v = Number((data as any)?.engagement_points ?? 0);
      if (!Number.isNaN(v)) setPoints(v);
    };

    void fetchPoints();
    const id = window.setInterval(fetchPoints, 2000);
    return () => { active = false; window.clearInterval(id); };
  }, [userId]);

  return points;
}
