/**
 * Client-side sampling helper for telemetry tables.
 * Reads sample rates from site_settings (cached) so they can be tuned
 * without a deploy. In DEV everything passes (rate=1).
 *
 * Usage:
 *   if (!(await shouldSampleTelemetry('web_vitals'))) return;
 *   supabase.rpc('log_web_vitals', {...});
 */
import { supabase } from '@/integrations/supabase/client';

type SampleKey = 'web_vitals' | 'query';

const SETTING_KEY: Record<SampleKey, string> = {
  web_vitals: 'telemetry_sample_rate_web_vitals',
  query: 'telemetry_sample_rate_query',
};

const DEFAULT_RATE: Record<SampleKey, number> = {
  web_vitals: 0.10,
  query: 0.05,
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<SampleKey, { rate: number; at: number }>();

async function fetchRate(kind: SampleKey): Promise<number> {
  const cached = cache.get(kind);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.rate;
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', SETTING_KEY[kind])
      .maybeSingle();
    const raw = data?.value as unknown;
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    const rate = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : DEFAULT_RATE[kind];
    cache.set(kind, { rate, at: Date.now() });
    return rate;
  } catch {
    return DEFAULT_RATE[kind];
  }
}

export async function shouldSampleTelemetry(kind: SampleKey): Promise<boolean> {
  if (import.meta.env?.DEV) return true;
  const rate = await fetchRate(kind);
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  return Math.random() < rate;
}

/** Synchronous variant — uses last cached rate (defaults until first fetch). */
export function shouldSampleTelemetrySync(kind: SampleKey): boolean {
  if (import.meta.env?.DEV) return true;
  const rate = cache.get(kind)?.rate ?? DEFAULT_RATE[kind];
  return Math.random() < rate;
}
