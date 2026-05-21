/**
 * Phase 1.9.38 — Sponsor Reflexive Lineage.
 */
import { deepFreeze, signObject } from './sponsorReflexivityInternals';
import type { SponsorReflexivityLayerDescriptor } from './sponsorRecursiveCompletenessProofs';

export interface SponsorReflexiveLineageEntry {
  readonly index: number;
  readonly layerId: string;
  readonly phase: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorReflexivityLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorReflexiveLineageEntry>;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
}

export function computeReflexiveLineage(
  descriptors: ReadonlyArray<SponsorReflexivityLayerDescriptor>,
): SponsorReflexivityLineage {
  const entries: SponsorReflexiveLineageEntry[] = [];
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
  const terminalSignature = entries.length
    ? entries[entries.length - 1].cumulativeSignature
    : 'empty';
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    lineageSignature,
    terminalSignature,
  });
}
