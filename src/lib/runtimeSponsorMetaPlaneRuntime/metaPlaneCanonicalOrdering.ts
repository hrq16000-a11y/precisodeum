/**
 * Phase 1.9.46 — Canonical ordering helpers.
 */
export function canonicalSortStrings(values: ReadonlyArray<string>): string[] {
  return [...values].sort();
}

export function canonicalSortBy<T>(
  values: ReadonlyArray<T>,
  key: (v: T) => string,
): T[] {
  return [...values].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

export function canonicalSortKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort();
}
