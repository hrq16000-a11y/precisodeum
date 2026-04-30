import { supabase } from '@/integrations/supabase/client';

/**
 * Instrumenta uma query crítica registrando a duração e metadados em
 * `public.query_telemetry` via RPC `log_query_telemetry`.
 *
 * - Não bloqueia a UI: o registro é fire-and-forget.
 * - Limitado a labels curtos (<= 64 chars) e duração max 600s por segurança.
 *
 * Uso:
 * ```ts
 * const { data, error } = await measureQuery('search.nearby_providers', () =>
 *   supabase.rpc('nearby_providers', { ... })
 * );
 * ```
 */
export async function measureQuery<T>(
  label: string,
  fn: () => Promise<T>,
  meta: Record<string, unknown> = {},
): Promise<T> {
  const t0 =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  let rows: number | null = null;
  let ok = true;
  try {
    const result = await fn();
    // tenta detectar tamanho de retorno (Supabase v2 → { data: [...] })
    const anyResult = result as unknown as { data?: unknown };
    if (anyResult && Array.isArray(anyResult.data)) {
      rows = anyResult.data.length;
    }
    return result;
  } catch (err) {
    ok = false;
    throw err;
  } finally {
    const t1 =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const duration = Math.max(0, Math.round(t1 - t0));
    // fire-and-forget
    void supabase
      .rpc('log_query_telemetry', {
        _label: label.slice(0, 64),
        _duration_ms: duration,
        _rows: rows,
        _meta: { ok, ...meta },
      })
      .then(() => undefined)
      .catch(() => undefined);
  }
}
