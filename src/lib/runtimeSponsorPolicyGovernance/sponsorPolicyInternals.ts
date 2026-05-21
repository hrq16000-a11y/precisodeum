/**
 * Phase 1.9.23 — Sponsor Policy Governance · internals.
 * READ-ONLY · DETERMINISTIC · ZERO UPSTREAM MUTATION · ZERO BUSINESS LOGIC.
 */

export const SPONSOR_POLICY_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  controlPlaneVersion: 'v1' as const,
  upstreamMutationAllowed: false,
  recalculationAllowed: false,
  businessLogicAllowed: false,
  persistenceEnabled: false,
  liveExecutionEnabled: false,
  postLockMutationAllowed: false,
  deterministicRollbackRequired: true,
});

export class SponsorPolicyMutationError extends Error {
  constructor(message: string) {
    super(`[sponsor-policy] ${message}`);
    this.name = 'SponsorPolicyMutationError';
  }
}

export class SponsorPolicyCompatibilityError extends Error {
  constructor(message: string) {
    super(`[sponsor-policy:compat] ${message}`);
    this.name = 'SponsorPolicyCompatibilityError';
  }
}

export class SponsorPolicyDeterminismError extends Error {
  constructor(message: string) {
    super(`[sponsor-policy:determinism] ${message}`);
    this.name = 'SponsorPolicyDeterminismError';
  }
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

export function signObject(value: unknown): string {
  return fnv1a(stableStringify(value));
}
