/**
 * useDashboardSessionPing — registra a entrada do profissional no dashboard
 * para alimentar a métrica de retenção (D1/D7/D30).
 *
 * Usa a RPC `record_dashboard_session` que aplica throttle de 30 min no servidor,
 * então é seguro chamar a cada montagem de DashboardLayout/rota do painel.
 *
 * Fail-soft: nunca lança e nunca bloqueia a UI.
 */
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useDashboardSessionPing(route?: string) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // pequeno delay para não competir com paint inicial
    const t = window.setTimeout(() => {
      if (cancelled) return;
      void supabase
        .rpc('record_dashboard_session', {
          _route: route || (typeof window !== 'undefined' ? window.location.pathname : null),
          _ua: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 280) : null,
        })
        .then(() => undefined, () => undefined);
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [user, route]);
}
