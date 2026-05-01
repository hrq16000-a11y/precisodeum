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
  origin_summary?: Record<string, unknown>;
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

    const fp = await sha256([
      ua,
      `${screen.width}x${screen.height}`,
      `${window.devicePixelRatio || 1}`,
      navigator.language || '',
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    ].join('|'));

    const referrer = document.referrer || '';
    const came_from_link = referrer.length > 0;

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
      was_moving: null,
      velocity_mps: null,

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
      device_imei: null, // só app nativo
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

      device_fingerprint: fp,
      origin_summary: input.origin_summary || {},
      raw_meta: {},
    };

    const { data, error } = await (supabase.rpc as any)('record_registration_snapshot', { _payload: payload });
    if (error) {
      console.warn('[registrationSnapshot] RPC failed:', error.message);
      return null;
    }
    return (data as string) || null;
  } catch (err) {
    console.warn('[registrationSnapshot] exception:', err);
    return null;
  }
}
