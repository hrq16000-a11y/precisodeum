/**
 * Phase 1.9.15 — Immutable snapshot helpers.
 */
import type { SponsorDecisionSnapshot } from './sponsorDecisionModel';

function stableStringify(value: unknown): string {
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

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return ('00000000' + hash.toString(16)).slice(-8);
}

export function signSnapshotPayload(payload: unknown): string {
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

export class SponsorDecisionMutationError extends Error {
  constructor(message: string) {
    super(`[sponsor-decision] ${message}`);
    this.name = 'SponsorDecisionMutationError';
  }
}

export function assertSnapshotLocked(snapshot: SponsorDecisionSnapshot): void {
  if (!snapshot.locked) {
    throw new SponsorDecisionMutationError('snapshot is not locked');
  }
  if (!Object.isFrozen(snapshot)) {
    throw new SponsorDecisionMutationError('snapshot root is not frozen');
  }
  if (!Object.isFrozen(snapshot.entries)) {
    throw new SponsorDecisionMutationError('snapshot.entries is not frozen');
  }
  if (!Object.isFrozen(snapshot.assignments)) {
    throw new SponsorDecisionMutationError('snapshot.assignments is not frozen');
  }
  if (snapshot.internals.postDecisionMutationAllowed !== false) {
    throw new SponsorDecisionMutationError('post-decision mutation flag must be false');
  }
}
