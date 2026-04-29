/**
 * Atualiza providers.last_active_at sempre que o usuário abre o dashboard.
 * Heartbeat leve: dispara 1x por sessão (debounce 1h).
 */
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const KEY = 'pdu_last_heartbeat';
const ONE_HOUR = 60 * 60 * 1000;

export function useProviderActivityHeartbeat(userId?: string | null) {
  useEffect(() => {
    if (!userId) return;
    try {
      const last = Number(localStorage.getItem(KEY) || '0');
      if (Date.now() - last < ONE_HOUR) return;
      localStorage.setItem(KEY, String(Date.now()));
    } catch { /* ignore */ }
    void supabase.rpc('touch_my_provider_activity').then(() => undefined, () => undefined);
  }, [userId]);
}
