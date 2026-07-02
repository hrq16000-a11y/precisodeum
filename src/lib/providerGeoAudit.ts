/**
 * providerGeoAudit — wrapper client-side para o histórico de origem da localização.
 *
 * Backend: provider_geo_audit + RPCs `list_my_geo_audit` / `record_my_geo_event`.
 * Owner-safe: as RPCs filtram por providers.user_id = auth.uid().
 */
import { supabase } from '@/integrations/supabase/client';

export type GeoEventType = 'location_updated' | 'gps_attempt' | 'cep_resolved' | 'manual_edit' | 'ip_fallback';
export type GeoSource = 'gps' | 'cep' | 'ip' | 'manual' | 'cache' | 'unknown';

export interface GeoAuditEntry {
  id: string;
  event_type: string;
  source: string;
  status: string;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface RecordGeoEventInput {
  event_type: GeoEventType;
  source: GeoSource;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy_m?: number | null;
  latency_ms?: number | null;
  status?: 'logged' | 'ok' | 'error' | 'reviewed';
  error_message?: string | null;
}

/**
 * Registra um evento de origem da localização para o provider do usuário logado.
 * Fail-soft: nunca lança — log apenas em console.
 */
export async function recordMyGeoEvent(input: RecordGeoEventInput): Promise<string | null> {
  try {
    const { data, error } = await (supabase.rpc as any)('record_my_geo_event', {
      _event_type: input.event_type,
      _source: input.source,
      _city: input.city ?? null,
      _state: input.state ?? null,
      _neighborhood: input.neighborhood ?? null,
      _latitude: input.latitude ?? null,
      _longitude: input.longitude ?? null,
      _accuracy_m: input.accuracy_m ?? null,
      _latency_ms: input.latency_ms ?? null,
      _status: input.status ?? 'logged',
      _error_message: input.error_message ?? null,
    });
    if (error) {
      // 42501 = no_provider_for_user (usuário ainda não tem provider) — silencioso.
      if (error.code !== '42501' && error.message !== 'no_provider_for_user') {
        console.debug('[providerGeoAudit] record failed:', error.message);
      }
      return null;
    }
    return (data as string) || null;
  } catch (err) {
    console.debug('[providerGeoAudit] exception:', err);
    return null;
  }
}

/** Lista o histórico de origem da localização do prestador logado. Fail-soft. */
export async function listMyGeoAudit(limit = 50): Promise<GeoAuditEntry[]> {
  try {
    const { data, error } = await (supabase.rpc as any)('list_my_geo_audit', { _limit: limit });
    if (error || !Array.isArray(data)) return [];
    return data as GeoAuditEntry[];
  } catch {
    return [];
  }
}
