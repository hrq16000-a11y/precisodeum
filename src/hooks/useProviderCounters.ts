/**
 * useProviderCounters
 *
 * Hook compartilhado que devolve os contadores básicos do prestador logado
 * usados tanto na home do Dashboard quanto em /dashboard/metricas.
 *
 * - Cache global de 5 minutos via react-query (staleTime 300_000ms).
 * - Queries em paralelo, com count: 'estimated' (evita full scan no Postgres).
 * - Tolerante a falhas individuais: se uma query falhar, o contador
 *   correspondente cai para 0 sem derrubar os demais.
 * - viewsTotal preserva a mesma lógica já existente (soma de
 *   services.view_count). NÃO foi reescrita — apenas movida para cá.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ProviderCounters {
  servicesCount: number;
  leadsCount: number;
  jobsCount: number;
  portfolioCount: number;
  /** Quantidade de álbuns de portfólio (usado em checklists do Dashboard). */
  portfolioAlbumCount: number;
  viewsTotal: number;
  reviewCount: number;
}

const EMPTY: ProviderCounters = {
  servicesCount: 0,
  leadsCount: 0,
  jobsCount: 0,
  portfolioCount: 0,
  portfolioAlbumCount: 0,
  viewsTotal: 0,
  reviewCount: 0,
};

async function safe<T>(p: PromiseLike<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

async function fetchCounters(providerId: string, userId: string | null): Promise<ProviderCounters> {
  // Álbuns primeiro (precisamos dos ids para contar fotos)
  const albumsRes = await safe(
    supabase.from('portfolio_albums').select('id').eq('provider_id', providerId),
    { data: [], error: null } as any,
  );
  const albumIds: string[] = (albumsRes.data || []).map((a: any) => a.id);

  const [sRes, lRes, pRes, rRes, jRes] = await Promise.all([
    safe(
      supabase
        .from('services')
        .select('id, view_count', { count: 'estimated' })
        .eq('provider_id', providerId),
      { data: [], count: 0, error: null } as any,
    ),
    safe(
      supabase
        .from('leads')
        .select('id', { count: 'estimated', head: true })
        .eq('provider_id', providerId),
      { count: 0, error: null } as any,
    ),
    albumIds.length > 0
      ? safe(
          supabase
            .from('portfolio_photos')
            .select('id', { count: 'estimated', head: true })
            .in('album_id', albumIds),
          { count: 0, error: null } as any,
        )
      : Promise.resolve({ count: 0, error: null } as any),
    safe(
      supabase
        .from('reviews')
        .select('id', { count: 'estimated', head: true })
        .eq('provider_id', providerId),
      { count: 0, error: null } as any,
    ),
    userId
      ? safe(
          supabase
            .from('jobs')
            .select('id', { count: 'estimated', head: true })
            .eq('user_id', userId),
          { count: 0, error: null } as any,
        )
      : Promise.resolve({ count: 0, error: null } as any),
  ]);

  const viewsTotal = (sRes.data || []).reduce(
    (acc: number, s: any) => acc + (s.view_count || 0),
    0,
  );

  return {
    servicesCount: sRes.count ?? 0,
    leadsCount: lRes.count ?? 0,
    portfolioCount: (pRes as any).count ?? 0,
    portfolioAlbumCount: albumIds.length,
    viewsTotal,
    reviewCount: rRes.count ?? 0,
    jobsCount: (jRes as any).count ?? 0,
  };
}

export interface UseProviderCountersResult extends ProviderCounters {
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useProviderCounters(): UseProviderCountersResult {
  const { user, provider } = useAuth();
  const providerId = provider?.id ?? null;
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ['provider-counters', providerId, userId],
    queryFn: () => fetchCounters(providerId as string, userId),
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000, // 5 minutos — não refetch entre /dashboard ↔ /dashboard/metricas
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const data = query.data ?? EMPTY;

  return {
    ...data,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    refetch: () => query.refetch(),
  };
}

export default useProviderCounters;
