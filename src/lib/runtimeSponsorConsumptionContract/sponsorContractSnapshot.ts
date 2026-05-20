/**
 * Phase 1.9.18 — Snapshot helpers. Pure / deterministic / no IO.
 */
import type { SponsorContractSnapshot } from './sponsorConsumptionContract';
import { SponsorContractIntegrityError } from './sponsorConsumptionContract';

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

export function signContractPayload(payload: unknown): string {
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

export function assertContractSnapshotLocked(snapshot: SponsorContractSnapshot): void {
  if (!snapshot.locked) {
    throw new SponsorContractIntegrityError('contract snapshot is not locked');
  }
  if (!Object.isFrozen(snapshot)) {
    throw new SponsorContractIntegrityError('contract snapshot root is not frozen');
  }
  if (!Object.isFrozen(snapshot.payload)) {
    throw new SponsorContractIntegrityError('contract snapshot.payload is not frozen');
  }
  if (!Object.isFrozen(snapshot.payload.slots)) {
    throw new SponsorContractIntegrityError('contract snapshot.payload.slots is not frozen');
  }
  if (snapshot.internals.recalculationAllowed !== false) {
    throw new SponsorContractIntegrityError('recalculationAllowed must be false');
  }
  if (snapshot.internals.upstreamMutationAllowed !== false) {
    throw new SponsorContractIntegrityError('upstreamMutationAllowed must be false');
  }
  if (snapshot.internals.internalLeakageAllowed !== false) {
    throw new SponsorContractIntegrityError('internalLeakageAllowed must be false');
  }
}
