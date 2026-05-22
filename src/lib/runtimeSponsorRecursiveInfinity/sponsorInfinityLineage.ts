/**
 * Phase 1.9.44 — Sponsor Infinity Lineage.
 */
import { deepFreeze, signObject } from './sponsorInfinityInternals';
import type { SponsorInfinityLayerDescriptor } from './sponsorRecursiveContainmentProofs';

export interface SponsorInfinityLineageEntry {
  readonly index: number;
  readonly layerId: string;
  readonly phase: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorInfinityLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorInfinityLineageEntry>;
  readonly lineageSignature: string;
  readonly infinitySignature: string;
}

export function computeInfinityLineage(
  descriptors: ReadonlyArray<SponsorInfinityLayerDescriptor>,
): SponsorInfinityLineage {
  const entries: SponsorInfinityLineageEntry[] = [];
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
  const infinitySignature = entries.length
    ? entries[entries.length - 1].cumulativeSignature
    : 'empty';
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    lineageSignature,
    infinitySignature,
  });
}
