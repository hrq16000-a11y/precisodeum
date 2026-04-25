import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const cache = new Map<string, { value: boolean; ts: number }>();
const TTL = 5 * 60 * 1000;

/**
 * Consulta a RPC `is_top_professional` para saber se o profissional cumpre os
 * critérios do selo "Profissional Top" (tier >= ativo + missões verify_name/verify_whatsapp).
 *
 * Funciona para visitantes anônimos — usado nos cards de busca e no perfil público.
 * Cache local por 5 min para evitar requests repetidos.
 */
export function useTopProfessional(userId?: string | null) {
  const [isTop, setIsTop] = useState<boolean>(() => {
    if (!userId) return false;
    const c = cache.get(userId);
    return c && Date.now() - c.ts < TTL ? c.value : false;
  });

  useEffect(() => {
    if (!userId) return;
    const c = cache.get(userId);
    if (c && Date.now() - c.ts < TTL) {
      setIsTop(c.value);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('is_top_professional' as any, {
          _user_id: userId,
        });
        if (!active) return;
        const v = !!data && !error;
        cache.set(userId, { value: v, ts: Date.now() });
        setIsTop(v);
      } catch {
        if (active) setIsTop(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  return isTop;
}
