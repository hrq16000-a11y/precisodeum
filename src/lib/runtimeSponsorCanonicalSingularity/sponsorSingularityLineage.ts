/**
 * Phase 1.9.41 — Sponsor Singularity Lineage.
 */
import { deepFreeze, signObject } from './sponsorSingularityInternals';
import type { SponsorSingularityLayerDescriptor } from './sponsorCanonicalCollapseProofs';

export interface SponsorSingularityLineageEntry {
  readonly index: number;
  readonly layerId: string;
  readonly phase: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorSingularityLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorSingularityLineageEntry>;
  readonly lineageSignature: string;
  readonly singularitySignature: string;
}

export function computeSingularityLineage(
  descriptors: ReadonlyArray<SponsorSingularityLayerDescriptor>,
): SponsorSingularityLineage {
  const entries: SponsorSingularityLineageEntry[] = [];
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
  const singularitySignature = entries.length
    ? entries[entries.length - 1].cumulativeSignature
    : 'empty';
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    lineageSignature,
    singularitySignature,
  });
}
