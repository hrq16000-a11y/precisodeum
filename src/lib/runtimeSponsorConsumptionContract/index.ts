/**
 * Phase 1.9.18 — Sponsor Consumption Contract Layer.
 * Single product-facing boundary over phases 1.9.14 → 1.9.17.
 * READ-ONLY / DETERMINISTIC / VERSIONED (v1).
 */
import type { SponsorCampaignSnapshot } from '@/lib/runtimeSponsorCampaignLayer';
import type { SponsorDecisionSnapshot } from '@/lib/runtimeSponsorDecisionFinalizer';
import type { TemporalSnapshot } from '@/lib/runtimeSponsorTemporalEvolutionEngine';
import type { SponsorContractSnapshot } from './sponsorConsumptionContract';
import { SPONSOR_CONTRACT_INTERNALS } from './sponsorConsumptionContract';
import {
  assertContractSnapshotLocked,
  deepFreeze,
  signContractPayload,
} from './sponsorContractSnapshot';
import { mapToConsumptionPayload } from './sponsorContractMapper';
import {
  assertNoInternalLeakage,
  validateConsumptionPayload,
} from './sponsorContractValidator';

export * from './sponsorConsumptionContract';
export {
  signContractPayload,
  deepFreeze as sponsorContractDeepFreeze,
  assertContractSnapshotLocked,
} from './sponsorContractSnapshot';
export {
  normalizeNumber as sponsorContractNormalizeNumber,
  sortSlotEntries,
  sortCampaignSummaries,
} from './sponsorContractNormalizer';
export { mapToConsumptionPayload } from './sponsorContractMapper';
export {
  validateConsumptionPayload,
  assertNoInternalLeakage,
} from './sponsorContractValidator';

export function buildContractSnapshot(
  decision: SponsorDecisionSnapshot,
  campaign: SponsorCampaignSnapshot,
  temporal: TemporalSnapshot,
): SponsorContractSnapshot {
  const payload = mapToConsumptionPayload(decision, campaign, temporal);
  validateConsumptionPayload(payload);
  assertNoInternalLeakage(payload);

  const signature = signContractPayload({
    contractVersion: 'v1',
    payload,
  });

  const snapshot: SponsorContractSnapshot = deepFreeze({
    contractVersion: 'v1' as const,
    internals: SPONSOR_CONTRACT_INTERNALS,
    payload,
    signature,
    upstreamSignatures: Object.freeze({
      decision: decision.signature,
      campaign: campaign.signature,
      temporal: temporal.signature,
    }),
    locked: true as const,
  });

  assertContractSnapshotLocked(snapshot);
  return snapshot;
}

/** Serialize the external payload deterministically (stable JSON). */
export function serializeContractPayload(snapshot: SponsorContractSnapshot): string {
  // Use stable stringify via signContractPayload's underlying helper — but we want the JSON text itself.
  // Re-implement minimal stable stringify here to keep this file self-contained.
  const stable = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map((v) => stable(v)).join(',') + ']';
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return (
      '{' +
      keys
        .map((k) => JSON.stringify(k) + ':' + stable((value as Record<string, unknown>)[k]))
        .join(',') +
      '}'
    );
  };
  return stable(snapshot.payload);
}
