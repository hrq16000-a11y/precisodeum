/**
 * Phase 1.9.19 — Sponsor API · Pure internal helpers.
 * Deterministic stringify + FNV-1a + deep freeze.
 */

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map((v) => stableStringify(v)).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return ('00000000' + hash.toString(16)).slice(-8);
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const k of Object.keys(value as Record<string, unknown>)) {
      const child = (value as Record<string, unknown>)[k];
      if (child && typeof child === 'object') deepFreeze(child);
    }
  }
  return value;
}

export const SPONSOR_API_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  liveExecutionEnabled: false as const,
  networkingEnabled: false as const,
  retryEnabled: false as const,
  backgroundEnabled: false as const,
  schedulingEnabled: false as const,
  recalculationAllowed: false as const,
  upstreamMutationAllowed: false as const,
  billingEnabled: false as const,
  chargesEnabled: false as const,
  pricingEnabled: false as const,
});
