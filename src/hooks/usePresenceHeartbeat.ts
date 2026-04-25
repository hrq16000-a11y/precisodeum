import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Mantém viva a sessão de presença do prestador no banco
 * (provider_presence_sessions). Heartbeat a cada 60s.
 * Encerra a sessão ao sair / aba escondida por mais de 60s.
 */
export function usePresenceHeartbeat(userId: string | undefined, enabled = true) {
  useEffect(() => {
    if (!enabled || !userId) return;

    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const beat = async () => {
      try {
        await supabase.rpc('track_presence_heartbeat' as any);
      } catch { /* silent */ }
    };

    const close = async () => {
      try {
        await supabase.rpc('close_presence_session' as any);
      } catch { /* silent */ }
    };

    const start = () => {
      if (!active) return;
      beat();
      if (interval) clearInterval(interval);
      interval = setInterval(beat, 60_000);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          if (interval) { clearInterval(interval); interval = null; }
          close();
        }, 60_000);
      } else {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', close);

    return () => {
      active = false;
      if (interval) clearInterval(interval);
      if (hideTimer) clearTimeout(hideTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', close);
      close();
    };
  }, [userId, enabled]);
}
