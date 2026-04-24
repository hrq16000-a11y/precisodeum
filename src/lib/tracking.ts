/**
 * Tracking utility for provider card events.
 * Logs impressions, clicks (WhatsApp, profile, banner) for analytics & monetization.
 */

type TrackEvent = 'card_view' | 'click_whatsapp' | 'click_profile' | 'click_banner'
  | 'click_highlight'
  | 'geo_resolved_city' | 'geo_resolved_metro' | 'geo_resolved_uf'
  | 'geo_fallback_text_only' | 'geo_failed_resolution'
  | 'geo_failed' | 'geo_fallback_used' | 'geo_source_changed'
  | 'sil_intent_detected' | 'sil_route_selected' | 'sil_geo_used'
  | 'sil_fallback_triggered' | 'sil_final_score';

interface TrackPayload {
  event: TrackEvent;
  provider_id?: string;
  sponsor_id?: string;
  slug?: string;
  source?: string;
  extra?: Record<string, string>;
}

const BATCH_INTERVAL = 3000;
let _batch: TrackPayload[] = [];
let _timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (_batch.length === 0) return;
  const events = [..._batch];
  _batch = [];

  // Fire-and-forget beacon
  try {
    const blob = new Blob([JSON.stringify(events)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', blob); // Future endpoint
    }
  } catch {
    // silent — tracking is non-critical
  }

  // Also store locally for analytics page
  try {
    const stored = JSON.parse(localStorage.getItem('pdu_events') || '[]');
    stored.push(...events.map(e => ({ ...e, ts: Date.now() })));
    // Keep last 500 events
    localStorage.setItem('pdu_events', JSON.stringify(stored.slice(-500)));
  } catch { /* silent */ }
}

export function trackEvent(payload: TrackPayload) {
  _batch.push(payload);
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(flush, BATCH_INTERVAL);
}

// Convenience helpers
export function trackCardView(providerId: string, slug: string, source = 'home') {
  trackEvent({ event: 'card_view', provider_id: providerId, slug, source });
}

export function trackWhatsAppClick(providerId: string, slug: string, source = 'home') {
  trackEvent({ event: 'click_whatsapp', provider_id: providerId, slug, source });
}

export function trackProfileClick(providerId: string, slug: string, source = 'home') {
  trackEvent({ event: 'click_profile', provider_id: providerId, slug, source });
}

export function trackBannerClick(sponsorId: string, source = 'home') {
  trackEvent({ event: 'click_banner', sponsor_id: sponsorId, source });
}

/** Track geo resolution events (GEO v5 telemetry) */
export function trackGeoEvent(event: TrackEvent, extra: Record<string, string>) {
  trackEvent({ event, extra });
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
}
