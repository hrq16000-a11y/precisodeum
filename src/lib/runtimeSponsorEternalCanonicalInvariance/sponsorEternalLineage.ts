/**
 * Phase 1.9.42 — Sponsor Eternal Lineage.
 */
import { deepFreeze, signObject } from './sponsorEternalInternals';
import type { SponsorEternalLayerDescriptor } from './sponsorPermanentStabilityProofs';

export interface SponsorEternalLineageEntry {
  readonly index: number;
  readonly layerId: string;
  readonly phase: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorEternalLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorEternalLineageEntry>;
  readonly lineageSignature: string;
  readonly eternalSignature: string;
}

export function computeEternalLineage(
  descriptors: ReadonlyArray<SponsorEternalLayerDescriptor>,
): SponsorEternalLineage {
  const entries: SponsorEternalLineageEntry[] = [];
  let cumulative = 'genesis';
  for (const d of descriptors) {
    cumulative = signObject({ prev: cumulative, sig: d.descriptorSignature });
    entries.push(
      Object.freeze({
        index: d.index,
        layerId: d.id,
        phase: d.phase,
        descriptorSignature: d.descriptorSignature,
        cumulativeSignature: cumulative,
      }),
    );
  }
  const lineageSignature = signObject(entries.map((e) => e.cumulativeSignature));
  const eternalSignature = entries.length
    ? entries[entries.length - 1].cumulativeSignature
    : 'empty';
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    lineageSignature,
    eternalSignature,
  });
}
