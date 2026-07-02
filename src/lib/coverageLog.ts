import { supabase } from '@/integrations/supabase/client';

interface LogParams {
  lat: number | null | undefined;
  lng: number | null | undefined;
  radius_m?: number | null;
  category_slug?: string | null;
  city_hint?: string | null;
  result_count?: number | null;
}

/**
 * Fire-and-forget coverage search log. Never throws, never blocks the UI.
 * Safe to call from any geo search path (RPC nearby_providers, public search, map page).
 */
export function logCoverageSearch(params: LogParams) {
  try {
    const { lat, lng } = params;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    // Microtask defer so the UI render and react-query callbacks are not delayed.
    setTimeout(() => {
      supabase
        .from('coverage_search_log' as any)
        .insert({
          lat,
          lng,
          radius_m: params.radius_m ?? null,
          category_slug: params.category_slug ?? null,
          city_hint: params.city_hint ?? null,
          result_count: params.result_count ?? null,
          user_agent:
            typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 240) : null,
        } as any)
        .then(() => undefined, () => undefined);
    }, 0);
  } catch {
    /* swallow */
  }
}
