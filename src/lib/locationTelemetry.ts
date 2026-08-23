/**
 * locationTelemetry — telemetria detalhada para erros e sucessos do GPS/CEP
 * dentro do Bet Mode (e fluxos correlatos).
 *
 * Por que separar:
 *  - O `trackGeoEvent` antigo só registrava em localStorage para a página de
 *    analytics interna; aqui persistimos em `onboarding_events` (RLS já
 *    permite insert anônimo + auth) para correlacionar com o funil.
 *  - Mantém um shape consistente: { kind, phase, latency_ms, error_code, ... }
 *    sem PII.
 *  - `latency_ms` é medido via helpers `startGpsTimer`/`startCepTimer` que
 *    retornam um `stop()` — evita time drift e erros de medição entre await.
 *
 * Privacidade:
 *  - Nunca persistimos coordenadas nem CEP em texto.
 *  - `error_code` é uma string enum (ex.: "permission_denied", "timeout",
 *    "viacep_not_found") — nunca a mensagem nativa do navegador.
 */
import { supabase } from '@/integrations/supabase/client';

export type GpsErrorCode =
  | 'permission_denied'   // navigator: code 1
  | 'position_unavailable'// navigator: code 2
  | 'timeout'             // navigator: code 3
  | 'unsupported'         // window/navigator.geolocation ausente
  | 'reverse_geocode_failed'
  | 'unknown';

export type CepErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'network'
  | 'timeout'
  | 'unknown';

export interface LocationEventBase {
  /** Fase do wizard onde aconteceu (ex.: 'pro_location', 'client_city'). */
  phase: string;
  /** ID do usuário, quando autenticado. */
  userId?: string | null;
  /** Quanto tempo demorou (ms) — usar `start*Timer().stop()`. */
  latency_ms?: number;
  /** Origem do rascunho — facilita correlacionar com `useBetRemoteDraft`. */
  draft_origin?: 'localStorage' | 'remote' | 'none';
}

export interface GpsAttemptEvent extends LocationEventBase {
  ok: boolean;
  /** Margem de precisão reportada (m). Apenas em sucesso. */
  accuracy_m?: number | null;
  /** Categorização do resultado de precisão. */
  accuracy_band?: 'high' | 'medium' | 'low' | 'unknown';
  error_code?: GpsErrorCode;
}

export interface CepAttemptEvent extends LocationEventBase {
  ok: boolean;
  error_code?: CepErrorCode;
  /** Hint anônimo para diagnosticar — apenas o tamanho dos inputs. */
  city_len?: number;
  neighborhood_len?: number;
}

function deviceKindFromUA(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|android|iphone/.test(ua)) return 'mobile';
  return 'desktop';
}

function bandForAccuracy(m: number | null | undefined): 'high' | 'medium' | 'low' | 'unknown' {
  if (m == null || !Number.isFinite(m)) return 'unknown';
  if (m <= 100) return 'high';
  if (m <= 500) return 'medium';
  return 'low';
}

async function persist(event: string, meta: Record<string, unknown>, userId?: string | null) {
  try {
    void supabase.from('onboarding_events' as any).insert({
      user_id: userId || null,
      session_id: getSessionId(),
      variant: 'v2',
      phase: String(meta.phase || 'unknown'),
      event,
      meta,
    } as any);
  } catch {
    /* fail-soft */
  }
}

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const k = 'onboarding_v2_session_id';
    let id = sessionStorage.getItem(k);
    if (!id) {
      id = String((crypto as any)?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
      sessionStorage.setItem(k, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}

/** Cronômetro simples — usar `const t = startGpsTimer(); ...; const ms = t.stop()` */
export function startGpsTimer() {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  return {
    stop(): number {
      const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      return Math.round(t1 - t0);
    },
  };
}
export const startCepTimer = startGpsTimer;

/** Mapeia o GeolocationPositionError do navegador para nosso enum. */
export function mapGeolocationError(err: unknown): GpsErrorCode {
  if (typeof err === 'object' && err && 'code' in (err as any)) {
    switch ((err as any).code) {
      case 1: return 'permission_denied';
      case 2: return 'position_unavailable';
      case 3: return 'timeout';
    }
  }
  return 'unknown';
}

export function trackGpsAttempt(ev: GpsAttemptEvent): void {
  const meta: Record<string, unknown> = {
    track: 'bet_mode',
    kind: 'gps',
    phase: ev.phase,
    ok: ev.ok,
    latency_ms: ev.latency_ms ?? null,
    accuracy_m: ev.accuracy_m ?? null,
    accuracy_band: ev.accuracy_band ?? bandForAccuracy(ev.accuracy_m),
    error_code: ev.error_code ?? null,
    device: deviceKindFromUA(),
    draft_origin: ev.draft_origin ?? 'none',
  };
  void persist(ev.ok ? 'gps_success' : 'gps_error', meta, ev.userId);
}

export function trackCepAttempt(ev: CepAttemptEvent): void {
  const meta: Record<string, unknown> = {
    track: 'bet_mode',
    kind: 'cep',
    phase: ev.phase,
    ok: ev.ok,
    latency_ms: ev.latency_ms ?? null,
    error_code: ev.error_code ?? null,
    city_len: ev.city_len ?? null,
    neighborhood_len: ev.neighborhood_len ?? null,
    device: deviceKindFromUA(),
    draft_origin: ev.draft_origin ?? 'none',
  };
  void persist(ev.ok ? 'cep_success' : 'cep_error', meta, ev.userId);
}

export function getDeviceKind(): 'mobile' | 'tablet' | 'desktop' {
  return deviceKindFromUA();
}
