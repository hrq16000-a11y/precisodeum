import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/** Widgets que NUNCA podem ser dispensados (espelha o backend). */
export const IMMUTABLE_WIDGETS = ['online_status', 'presence', 'availability'] as const;

export interface DashboardState {
  user_id: string;
  visits_count: number;
  last_visit_at: string | null;
  first_visit_at: string;
  dismissed_widgets: string[];
}

/**
 * Hook centralizado que substitui flags em localStorage.
 * - registerVisit() incrementa contagem ao entrar no /dashboard.
 * - dismissWidget(key) / restoreWidget(key) sincronizam server-side.
 * - isWidgetDismissed(key) consulta de forma estável.
 *
 * Widgets IMUTÁVEIS (online_status/presence/availability) jamais são tratados como dispensáveis.
 */
export function useDashboardState() {
  const { user } = useAuth();
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(false);
  const visitRegisteredRef = useRef(false);

  const fetchState = useCallback(async () => {
    if (!user?.id) {
      setState(null);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_dashboard_state')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!error && data) setState(data as DashboardState);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  const registerVisit = useCallback(async () => {
    if (!user?.id || visitRegisteredRef.current) return;
    visitRegisteredRef.current = true;
    const { data, error } = await supabase.rpc('register_dashboard_visit');
    if (!error && data) setState(data as unknown as DashboardState);
  }, [user?.id]);

  const dismissWidget = useCallback(
    async (key: string) => {
      if (IMMUTABLE_WIDGETS.includes(key as typeof IMMUTABLE_WIDGETS[number])) {
        return; // bloqueio defensivo no client
      }
      const { data, error } = await supabase.rpc('dismiss_dashboard_widget', { _widget: key });
      if (!error && data) setState(data as unknown as DashboardState);
    },
    []
  );

  const restoreWidget = useCallback(async (key: string) => {
    const { data, error } = await supabase.rpc('restore_dashboard_widget', { _widget: key });
    if (!error && data) setState(data as unknown as DashboardState);
  }, []);

  const isWidgetDismissed = useCallback(
    (key: string) => {
      if (IMMUTABLE_WIDGETS.includes(key as typeof IMMUTABLE_WIDGETS[number])) return false;
      return state?.dismissed_widgets?.includes(key) ?? false;
    },
    [state]
  );

  return {
    state,
    loading,
    registerVisit,
    dismissWidget,
    restoreWidget,
    isWidgetDismissed,
    refetch: fetchState,
  };
}
