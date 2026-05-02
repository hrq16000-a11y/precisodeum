/**
 * registrationSnapshot — coleta cliente-side dos dados forenses do cadastro
 * e grava (uma vez) via RPC `record_registration_snapshot`.
 *
 * Limitações conhecidas:
 * - IMEI e marca/modelo exato não existem em Web APIs. Só preenchemos via
 *   Capacitor (app nativo), em fluxo separado.
 * - IP/ISP/Geo IP são obtidos por uma chamada externa (ipapi.co fallback).
 *   Em produção isso pode ser substituído por uma edge que use o IP real
 *   do request, mas para LGPD/auditoria a auto-declaração já vale.
 *
 * Idempotência: a RPC ignora chamadas subsequentes (1 snapshot por user).
 */

import { supabase } from '@/integrations/supabase/client';

interface CollectInput {
  whatsapp?: string | null;
  postal_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy_m?: number | null;
  /** Velocidade reportada pelo Geolocation API (m/s). */
  velocity_mps?: number | null;
  /** Se o usuário aceitou os Termos no clique Finalizar. */
  terms_accepted?: boolean;
  /** Versão dos Termos aceitos (ex.: '2025-04-01'). */
  terms_version?: string | null;
  origin_summary?: Record<string, unknown>;
}

/** Network Information API (não disponível em Safari). */
function readNetworkInfo(): { type?: string; downlink?: number; rtt?: number } {
  try {
    const c = (navigator as any)?.connection
      || (navigator as any)?.mozConnection
      || (navigator as any)?.webkitConnection;
    if (!c) return {};
    return {
      type: typeof c.effectiveType === 'string' ? c.effectiveType : (typeof c.type === 'string' ? c.type : undefined),
      downlink: typeof c.downlink === 'number' ? c.downlink : undefined,
      rtt: typeof c.rtt === 'number' ? c.rtt : undefined,
    };
  } catch { return {}; }
}

/** Heurística de movimento — em campo vs home office. */
function inferMovement(velocity_mps?: number | null, accuracy_m?: number | null): boolean | null {
  if (typeof velocity_mps === 'number' && Number.isFinite(velocity_mps)) {
    return velocity_mps > 1.0; // > ~3.6 km/h ≈ caminhando
  }
  // Fallback: precisão muito boa em ambiente fechado costuma ser estática.
  if (typeof accuracy_m === 'number' && Number.isFinite(accuracy_m)) {
    return accuracy_m > 50 ? null : false;
  }
  return null;
}

/** Classifica origem do tráfego para meta_tracking.referrer_kind. */
function classifyReferrer(referrer: string, utm: Record<string, string | undefined>): string {
  if (utm.utm_source) return `utm:${utm.utm_source}`;
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (/google\./.test(host)) return 'organic:google';
    if (/instagram\./.test(host)) return 'social:instagram';
    if (/facebook\./.test(host) || /fb\./.test(host)) return 'social:facebook';
    if (/linkedin\./.test(host)) return 'social:linkedin';
    if (/twitter\.|x\.com/.test(host)) return 'social:x';
    if (/whatsapp\.|wa\.me/.test(host)) return 'social:whatsapp';
    if (/tiktok\./.test(host)) return 'social:tiktok';
    return `referral:${host}`;
  } catch { return 'unknown'; }
}

function parseUA(ua: string): {
  os_name: string;
  os_version: string;
  browser_name: string;
  browser_version: string;
  device_brand: string;
  device_model: string;
} {
  const lower = ua.toLowerCase();
  let os_name = 'Unknown';
  let os_version = '';
  if (/windows/.test(lower)) os_name = 'Windows';
  else if (/iphone|ipad|ipod/.test(lower)) os_name = 'iOS';
  else if (/android/.test(lower)) {
    os_name = 'Android';
    os_version = (lower.match(/android\s([\d.]+)/) || [])[1] || '';
  } else if (/mac/.test(lower)) os_name = 'macOS';
  else if (/linux/.test(lower)) os_name = 'Linux';

  let browser_name = 'Unknown';
  let browser_version = '';
  if (/edg\//.test(lower)) {
    browser_name = 'Edge';
    browser_version = (lower.match(/edg\/([\d.]+)/) || [])[1] || '';
  } else if (/chrome\//.test(lower) && !/edg\//.test(lower)) {
    browser_name = 'Chrome';
    browser_version = (lower.match(/chrome\/([\d.]+)/) || [])[1] || '';
  } else if (/firefox\//.test(lower)) {
    browser_name = 'Firefox';
    browser_version = (lower.match(/firefox\/([\d.]+)/) || [])[1] || '';
  } else if (/safari\//.test(lower) && !/chrome\//.test(lower)) {
    browser_name = 'Safari';
    browser_version = (lower.match(/version\/([\d.]+)/) || [])[1] || '';
  }

  // Inferência grosseira de marca/modelo a partir do UA Android
  let device_brand = '';
  let device_model = '';
  const m = ua.match(/\(Linux;\s+Android[^;]+;\s+([^)]+)\)/i);
  if (m && m[1]) {
    const raw = m[1].trim().split(/\s+Build/i)[0];
    const parts = raw.split(/\s+/);
    device_brand = parts[0] || '';
    device_model = parts.slice(1).join(' ');
  } else if (/iphone/i.test(ua)) {
    device_brand = 'Apple';
    device_model = 'iPhone';
  } else if (/ipad/i.test(ua)) {
    device_brand = 'Apple';
    device_model = 'iPad';
  }

  return { os_name, os_version, browser_name, browser_version, device_brand, device_model };
}

async function sha256(text: string): Promise<string> {
  try {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return '';
  }
}

function readUtm(): Record<string, string | undefined> {
  try {
    const url = new URL(window.location.href);
    return {
      utm_source: url.searchParams.get('utm_source') || undefined,
      utm_medium: url.searchParams.get('utm_medium') || undefined,
      utm_campaign: url.searchParams.get('utm_campaign') || undefined,
      utm_term: url.searchParams.get('utm_term') || undefined,
      utm_content: url.searchParams.get('utm_content') || undefined,
    };
  } catch {
    return {};
  }
}

async function fetchGeoIp(): Promise<{
  ip?: string; isp?: string; country?: string; region?: string; city?: string;
}> {
  try {
    const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return {};
    const j = await r.json();
    return {
      ip: j.ip,
      isp: j.org || j.asn || '',
      country: j.country_name || j.country,
      region: j.region,
      city: j.city,
    };
  } catch {
    return {};
  }
}

async function readBattery(): Promise<{ level?: number; charging?: boolean }> {
  try {
    const nav = navigator as any;
    if (typeof nav.getBattery === 'function') {
      const b = await nav.getBattery();
      return { level: typeof b.level === 'number' ? b.level : undefined, charging: !!b.charging };
    }
  } catch { /* noop */ }
  return {};
}

function getSignupMethod(user: any): string {
  try {
    const provider = user?.app_metadata?.provider;
    if (provider) return provider;
  } catch { /* noop */ }
  return 'email_password';
}

/**
 * Coleta tudo que conseguimos no browser e grava o snapshot via RPC.
 * Idempotente: chamadas extras retornam o mesmo id.
 */
export async function recordRegistrationSnapshotOnce(input: CollectInput): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Já existe? evita esforço desnecessário.
    const { data: existing } = await supabase
      .from('registration_snapshots' as any)
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if ((existing as any)?.id) return (existing as any).id as string;

    const ua = navigator.userAgent || '';
    const { os_name, os_version, browser_name, browser_version, device_brand, device_model } = parseUA(ua);
    const utm = readUtm();
    const geo = await fetchGeoIp();
    const battery = await readBattery();
    const net = readNetworkInfo();
    const moving = inferMovement(input.velocity_mps, input.accuracy_m);
    const referrer = document.referrer || '';
    const came_from_link = referrer.length > 0;
    const referrer_kind = classifyReferrer(referrer, utm);

    const fp = await sha256([
      ua,
      `${screen.width}x${screen.height}`,
      `${window.devicePixelRatio || 1}`,
      navigator.language || '',
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    ].join('|'));

    const terms_accepted_at = input.terms_accepted ? new Date().toISOString() : null;

    const payload: Record<string, unknown> = {
      signup_method: getSignupMethod(user),
      auth_provider: (user as any)?.app_metadata?.provider || 'email',
      signup_referrer: referrer,
      ...utm,
      landing_url: window.location.origin + window.location.pathname,
      came_from_link,

      ip_address: geo.ip,
      isp: geo.isp,
      country: geo.country,
      region: geo.region,
      city_geoip: geo.city,

      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      accuracy_m: input.accuracy_m ?? null,
      was_moving: moving,
      velocity_mps: input.velocity_mps ?? null,

      postal_code: input.postal_code ?? null,
      street: input.street ?? null,
      street_number: input.street_number ?? null,
      neighborhood: input.neighborhood ?? null,
      city: input.city ?? null,
      state: input.state ?? null,

      whatsapp: input.whatsapp ?? null,
      email: user.email ?? null,

      user_agent: ua,
      device_brand,
      device_model,
      device_imei: null,
      os_name,
      os_version,
      browser_name,
      browser_version,
      screen_width: screen.width,
      screen_height: screen.height,
      device_pixel_ratio: window.devicePixelRatio || 1,
      language: navigator.language || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',

      battery_level: battery.level ?? null,
      battery_charging: battery.charging ?? null,
      online_at_signup: navigator.onLine,

      // Novos: Network Info + termos
      connection_type: net.type ?? null,
      connection_downlink_mbps: net.downlink ?? null,
      connection_rtt_ms: net.rtt ?? null,
      terms_version: input.terms_version ?? null,
      terms_accepted_at,

      device_fingerprint: fp,
      origin_summary: { referrer_kind, ...(input.origin_summary || {}) },
      raw_meta: {},
    };

    const { data, error } = await (supabase.rpc as any)('record_registration_snapshot', { _payload: payload });
    if (error) {
      console.warn('[registrationSnapshot] RPC failed:', error.message);
      return null;
    }

    // Espelho leve em providers.meta_tracking (consolidação solicitada). Best-effort.
    try {
      const meta_tracking = {
        version: 1,
        captured_at: new Date().toISOString(),
        attribution: { referrer_kind, ...utm, came_from_link },
        device: { os_name, os_version, browser_name, browser_version, device_brand, device_model, ua_kind: deviceKindFromScreen() },
        screen: { w: screen.width, h: screen.height, dpr: window.devicePixelRatio || 1 },
        locale: { language: navigator.language || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null },
        network: { type: net.type ?? null, downlink_mbps: net.downlink ?? null, rtt_ms: net.rtt ?? null, online: navigator.onLine },
        movement: { was_moving: moving, velocity_mps: input.velocity_mps ?? null, accuracy_m: input.accuracy_m ?? null },
        terms: { accepted: !!input.terms_accepted, version: input.terms_version ?? null, accepted_at: terms_accepted_at },
        fingerprint_short: fp ? fp.slice(0, 16) : null, // hash truncado, sem PII
      };
      await supabase
        .from('providers' as any)
        .update({ meta_tracking } as any)
        .eq('user_id', user.id);
    } catch (e) {
      // não bloqueia — providers pode não existir ainda nesse exato momento
      console.warn('[registrationSnapshot] meta_tracking mirror skipped:', e);
    }

    return (data as string) || null;
  } catch (err) {
    console.warn('[registrationSnapshot] exception:', err);
    return null;
  }
}

function deviceKindFromScreen(): 'mobile' | 'tablet' | 'desktop' | 'tv' {
  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    if (/smarttv|smart-tv|googletv|appletv|hbbtv|netcast|viera|tizen.*tv|webos.*tv/.test(ua)) return 'tv';
    if (/ipad|tablet/.test(ua)) return 'tablet';
    if (/mobi|android|iphone/.test(ua)) return 'mobile';
    return 'desktop';
  } catch { return 'desktop'; }
}
