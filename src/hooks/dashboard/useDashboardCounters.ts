/**
 * useDashboardCounters
 * --------------------
 * Re-export do `useProviderCounters` (ETAPA 3) para manter a convenção
 * de hooks de dashboard centralizados em `src/hooks/dashboard/`.
 *
 * NÃO duplica lógica — apenas reexporta a fonte única já cacheada
 * (5min staleTime) compartilhada entre /dashboard e /dashboard/metricas.
 */
export { useProviderCounters as useDashboardCounters } from '@/hooks/useProviderCounters';
