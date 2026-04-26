/**
 * Centralized cache invalidation for provider-related React Query keys
 * and the localStorage cache used by `useFeaturedProviders`.
 *
 * Call `invalidateProviderCaches(queryClient, { reason: 'profile-updated' })`
 * after any operation that enriches or corrects profile data (e.g. user
 * uploads avatar, fixes full_name, completes onboarding) so the UI does NOT
 * keep showing stale generic names or placeholder avatars.
 */
import type { QueryClient } from '@tanstack/react-query';

export interface InvalidateProviderCachesOptions {
  /** For logging / analytics. */
  reason?: string;
  /** Optional: limit invalidation to a specific user. Currently logs only —
   *  React Query keys are coarse-grained at this level. */
  userId?: string;
}

const PROVIDER_QUERY_KEYS: readonly string[] = [
  'featured-providers',
  'nearby-providers',
  'providers',
  'provider',
  'providers-search',
  'public-profile',
  'profile',
];

const FEATURED_LS_PREFIX = 'featured-providers:';

export function invalidateProviderCaches(
  queryClient: QueryClient,
  options: InvalidateProviderCachesOptions = {}
): void {
  const { reason = 'unknown', userId } = options;

  // 1) React Query — invalidate all provider-related keys.
  PROVIDER_QUERY_KEYS.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });

  // 2) localStorage — drop the persisted "featured" snapshot so the next
  //    render fetches fresh data instead of using stale cached entries.
  if (typeof window !== 'undefined') {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(FEATURED_LS_PREFIX)) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* quota / privacy mode — ignore */
    }
  }

  // 3) Lightweight log so we can track invalidation patterns.
  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.info('[providerCache] invalidated', { reason, userId });
  }
}
