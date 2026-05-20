/**
 * Phase 1.9.17 — Snapshot helpers. Pure / deterministic / no IO.
 */
import type { TemporalSnapshot } from './sponsorTemporalModel';
import { SponsorTemporalIntegrityError } from './sponsorTemporalModel';

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableStringify(v)).join(',') + ']';
  }
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

export function signTemporalPayload(payload: unknown): string {
  return fnv1a(stableStringify(payload));
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

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Deterministic integer power for non-negative integer exponent. */
export function intPow(base: number, exp: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(exp)) return 0;
  if (exp <= 0) return 1;
  let result = 1;
  let b = base;
  let e = Math.trunc(exp);
  while (e > 0) {
    if ((e & 1) === 1) result *= b;
    b *= b;
    e >>>= 1;
  }
  return result;
}

export function assertTemporalSnapshotLocked(snapshot: TemporalSnapshot): void {
  if (!snapshot.locked) {
    throw new SponsorTemporalIntegrityError('temporal snapshot is not locked');
  }
  if (!Object.isFrozen(snapshot)) {
    throw new SponsorTemporalIntegrityError('temporal snapshot root is not frozen');
  }
  if (!Object.isFrozen(snapshot.frames)) {
    throw new SponsorTemporalIntegrityError('temporal snapshot.frames is not frozen');
  }
  if (snapshot.internals.decisionalImpactAllowed !== false) {
    throw new SponsorTemporalIntegrityError('decisionalImpactAllowed must be false');
  }
  if (snapshot.internals.campaignMutationAllowed !== false) {
    throw new SponsorTemporalIntegrityError('campaignMutationAllowed must be false');
  }
  if (snapshot.internals.realClockAllowed !== false) {
    throw new SponsorTemporalIntegrityError('realClockAllowed must be false');
  }
}
