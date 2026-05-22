/**
 * Phase 1.9.43 — Sponsor Transcendent Lineage.
 */
import { deepFreeze, signObject } from './sponsorTranscendentInternals';
import type { SponsorTranscendentLayerDescriptor } from './sponsorUniversalSelfEquivalenceProofs';

export interface SponsorTranscendentLineageEntry {
  readonly index: number;
  readonly layerId: string;
  readonly phase: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorTranscendentLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorTranscendentLineageEntry>;
  readonly lineageSignature: string;
  readonly transcendentSignature: string;
}

export function computeTranscendentLineage(
  descriptors: ReadonlyArray<SponsorTranscendentLayerDescriptor>,
): SponsorTranscendentLineage {
  const entries: SponsorTranscendentLineageEntry[] = [];
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
  const transcendentSignature = entries.length
    ? entries[entries.length - 1].cumulativeSignature
    : 'empty';
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    lineageSignature,
    transcendentSignature,
  });
}
