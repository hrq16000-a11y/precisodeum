/**
 * Phase 1.9.32 — Sponsor Closure Lineage.
 * Deterministic cumulative chain across descriptors.
 */
import { deepFreeze, signObject } from './sponsorClosureInternals';
import type { SponsorClosureLayerDescriptor } from './sponsorTerminalConsistencyProofs';

export interface SponsorClosureLineageEntry {
  readonly index: number;
  readonly layerId: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorClosureLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorClosureLineageEntry>;
  readonly lineageSignature: string;
}

export function computeClosureLineage(
  descriptors: ReadonlyArray<SponsorClosureLayerDescriptor>,
): SponsorClosureLineage {
  const entries: SponsorClosureLineageEntry[] = [];
  let cumulative = '00000000';
  descriptors.forEach((d, index) => {
    cumulative = signObject({ prev: cumulative, sig: d.descriptorSignature });
    entries.push(
      Object.freeze({
        index,
        layerId: d.id,
        descriptorSignature: d.descriptorSignature,
        cumulativeSignature: cumulative,
      }),
    );
  });
  const lineageSignature = signObject(entries.map((e) => e.cumulativeSignature));
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    lineageSignature,
  });
}
