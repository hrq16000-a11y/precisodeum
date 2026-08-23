/**
 * Tracking utility for provider card events.
 * Logs impressions, clicks (WhatsApp, profile, banner) for analytics & monetization.
 *
 * Eventos de clique em contato (whatsapp/phone/profile) também disparam
 * `track_lead_interaction` no banco de forma assíncrona (fire-and-forget).
 */
import { supabase } from '@/integrations/supabase/client';

type TrackEvent = 'card_view' | 'click_whatsapp' | 'click_profile' | 'click_banner'
  | 'click_highlight'
  | 'geo_resolved_city' | 'geo_resolved_metro' | 'geo_resolved_uf'
  | 'geo_fallback_text_only' | 'geo_failed_resolution'
  | 'geo_failed' | 'geo_fallback_used' | 'geo_source_changed'
  | 'sil_intent_detected' | 'sil_route_selected' | 'sil_geo_used'
  | 'sil_fallback_triggered' | 'sil_final_score'
  | 'hero_phrase_shown' | 'hero_cta_click';

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

function getUaHash(): string {
  try {
    const key = 'pdu_ua_hash';
    let v = localStorage.getItem(key);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, v);
    }
    return v;
  } catch { return 'anon'; }
}

async function recordLeadInteraction(
  providerId: string,
  type: 'whatsapp' | 'phone' | 'profile' | 'click' | 'share',
  source: string,
  serviceId?: string,
) {
  try {
    await supabase.rpc('track_lead_interaction', {
      _provider_id: providerId,
      _service_id: serviceId ?? null,
      _type: type,
      _source: source,
      _ua_hash: getUaHash(),
    });
  } catch { /* silent — tracking não bloqueia ação */ }
}

/**
 * Persiste o clique em `contact_clicks` com rota e categoria, permitindo
 * relatórios consistentes de conversão por rota/categoria no admin.
 */
async function recordContactClick(
  providerId: string,
  type: 'whatsapp' | 'phone' | 'profile',
  extra?: Record<string, string>,
) {
  try {
    let path = '';
    try { path = window.location.pathname || ''; } catch { /* SSR/test */ }
    await supabase.rpc('log_contact_click' as never, {
      _provider_id: providerId,
      _contact_type: type,
      _page_path: path,
      _visitor_id: getUaHash(),
      _category_slug: extra?.category_slug || extra?.category || null,
    } as never);
  } catch { /* silent */ }
}

/** Contexto extra de conversão: rota atual + tipo de profissional (pf/company). */
function conversionContext(extra?: Record<string, string>): Record<string, string> {
  let route = '';
  try { route = window.location.pathname || ''; } catch { /* SSR/test */ }
  return { route, ...(extra || {}) };
}

export function trackWhatsAppClick(
  providerId: string,
  slug: string,
  source = 'home',
  serviceId?: string,
  extra?: Record<string, string>,
) {
  trackEvent({ event: 'click_whatsapp', provider_id: providerId, slug, source, extra: conversionContext(extra) });
  void recordLeadInteraction(providerId, 'whatsapp', source, serviceId);
  void recordContactClick(providerId, 'whatsapp', extra);
}

export function trackPhoneClick(
  providerId: string,
  slug: string,
  source = 'home',
  serviceId?: string,
  extra?: Record<string, string>,
) {
  trackEvent({ event: 'click_whatsapp', provider_id: providerId, slug, source, extra: conversionContext({ kind: 'phone', ...(extra || {}) }) });
  void recordLeadInteraction(providerId, 'phone', source, serviceId);
  void recordContactClick(providerId, 'phone', extra);
}

export function trackProfileClick(
  providerId: string,
  slug: string,
  source = 'home',
  extra?: Record<string, string>,
) {
  trackEvent({ event: 'click_profile', provider_id: providerId, slug, source, extra: conversionContext(extra) });
  void recordLeadInteraction(providerId, 'profile', source);
  void recordContactClick(providerId, 'profile', extra);
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
