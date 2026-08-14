import { trackingRpc } from '@/lib/tracking/safeRpc';
import { trackingDedupeKey, claimLocalDedupe, getVisitorId } from '@/lib/tracking/dedupeKey';

let lastLog = 0;

/**
 * Logs a search intent (category + city) to power the FOMO demand alerts
 * shown to providers in their dashboard. Throttled to one log per 1.5s.
 */
export async function logSearchIntent(params: {
  categorySlug?: string | null;
  categoryName?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  const now = Date.now();
  if (now - lastLog < 1500) return;
  lastLog = now;
  const visitorId = getVisitorId();
  const key = trackingDedupeKey('search_intent', [
    params.categorySlug,
    params.categoryName,
    params.city,
    params.state,
  ]);
  if (!claimLocalDedupe(key)) return;

  await trackingRpc('log_search_intent', {
    _category_slug: params.categorySlug || null,
    _category_name: params.categoryName || null,
    _city: params.city || null,
    _state: params.state || null,
    _visitor_id: visitorId,
    _dedupe_key: key,
  });
}
