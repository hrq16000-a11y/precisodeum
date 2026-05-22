/**
 * Phase 1.9.46 — Deep freeze helper. Idempotent and read-only.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value as Record<string, unknown>)) {
    const v = (value as Record<string, unknown>)[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return value;
}
