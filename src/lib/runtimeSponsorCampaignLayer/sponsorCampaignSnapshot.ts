/**
 * Phase 1.9.16 — Snapshot helpers. Pure / deterministic / no IO.
 */
import type { SponsorCampaignSnapshot } from './sponsorCampaignModel';
import { SponsorCampaignIntegrityError } from './sponsorCampaignModel';

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

export function signCampaignPayload(payload: unknown): string {
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

export function assertCampaignSnapshotLocked(snapshot: SponsorCampaignSnapshot): void {
  if (!snapshot.locked) {
    throw new SponsorCampaignIntegrityError('campaign snapshot is not locked');
  }
  if (!Object.isFrozen(snapshot)) {
    throw new SponsorCampaignIntegrityError('campaign snapshot root is not frozen');
  }
  if (!Object.isFrozen(snapshot.campaigns)) {
    throw new SponsorCampaignIntegrityError('campaign snapshot.campaigns is not frozen');
  }
  if (!Object.isFrozen(snapshot.nodeToCampaign)) {
    throw new SponsorCampaignIntegrityError('campaign snapshot.nodeToCampaign is not frozen');
  }
  if (snapshot.internals.decisionalImpactAllowed !== false) {
    throw new SponsorCampaignIntegrityError('decisionalImpactAllowed must be false');
  }
  if (snapshot.internals.billingEnabled !== false) {
    throw new SponsorCampaignIntegrityError('billingEnabled must be false');
  }
}
