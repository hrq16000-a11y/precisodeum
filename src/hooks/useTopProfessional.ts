import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const cache = new Map<string, { value: boolean; ts: number }>();
const TTL = 5 * 60 * 1000;

/**
 * Indica se o profissional cumpre os critérios objetivos do selo "Profissional Top".
 *
 * Fonte canônica: `providers.is_verified` — recomputado por trigger ao alterar:
 *   - foto, descrição (>=30), >=1 serviço ativo (não excluído)
 *   - WhatsApp válido (10–11 dígitos locais ou 12–13 com DDI 55)
 *   - cidade preenchida + lat/lng (GPS)
 *
 * Override admin: quando `verified_manual=true`, a recomputação automática
 * preserva a decisão do admin (set/unset) — registrada com autor + motivo.
 *
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
        const { data, error } = await supabase
          .from('providers')
          .select('is_verified')
          .eq('user_id', userId)
          .maybeSingle();
        if (!active) return;
        const v = !!data?.is_verified && !error;
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

/**
 * Limpa o cache local — útil após uma ação de admin (set/unset manual)
 * para que o próximo render reflita imediatamente.
 */
export function invalidateTopProfessionalCache(userId?: string | null) {
  if (!userId) {
    cache.clear();
    return;
  }
  cache.delete(userId);
}
