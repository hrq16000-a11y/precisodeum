/**
 * useDashboardLayout — lê o layout configurado pelo admin para um
 * tipo de perfil em `site_settings` (chave `dashboard_layout_<type>`),
 * faz parse seguro do JSON e mescla com os defaults.
 *
 * Cache via react-query (staleTime 5min). Falha-soft: se a chave não
 * existir ou for inválida, retorna o default do tipo — nunca quebra
 * o dashboard.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  DASHBOARD_LAYOUT_KEYS,
  DEFAULT_DASHBOARD_LAYOUTS,
  DashboardLayoutItem,
  DashboardProfileType,
  mergeWithDefaults,
} from '@/lib/dashboardLayoutDefaults';

function parseLayout(raw: string | null | undefined): DashboardLayoutItem[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((it) => it && typeof it.id === 'string')
      .map((it) => ({
        id: String(it.id),
        label: typeof it.label === 'string' ? it.label : it.id,
        visible: it.visible !== false,
        order: typeof it.order === 'number' ? it.order : 0,
      }));
  } catch {
    return null;
  }
}

export function useDashboardLayout(profileType: DashboardProfileType | null | undefined) {
  const safeType: DashboardProfileType = (profileType ?? 'provider') as DashboardProfileType;
  const key = DASHBOARD_LAYOUT_KEYS[safeType];

  const query = useQuery({
    queryKey: ['dashboard-layout', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings' as any)
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (error) return null;
      return parseLayout((data as any)?.value);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const layout = useMemo<DashboardLayoutItem[]>(() => {
    return mergeWithDefaults(safeType, query.data ?? null);
  }, [safeType, query.data]);

  const visibleOrdered = useMemo(
    () => layout.filter((it) => it.visible).sort((a, b) => a.order - b.order),
    [layout],
  );

  const isVisible = (id: string) => visibleOrdered.some((it) => it.id === id);

  return {
    layout,
    visibleOrdered,
    isVisible,
    isLoading: query.isLoading,
    /** Lista de IDs ordenados conforme configuração. */
    orderedIds: visibleOrdered.map((it) => it.id),
    /** Defaults p/ comparação visual ("restaurar padrão"). */
    defaults: DEFAULT_DASHBOARD_LAYOUTS[safeType],
  };
}
