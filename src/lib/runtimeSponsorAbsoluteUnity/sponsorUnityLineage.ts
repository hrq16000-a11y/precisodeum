/**
 * Phase 1.9.37 — Sponsor Unity Lineage.
 */
import { deepFreeze, signObject } from './sponsorUnityInternals';
import type { SponsorUnityLayerDescriptor } from './sponsorSelfEquivalenceProofs';

export interface SponsorUnityLineageEntry {
  readonly index: number;
  readonly id: SponsorUnityLayerDescriptor['id'];
  readonly phase: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorUnityLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorUnityLineageEntry>;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
}

export function computeUnityLineage(
  descriptors: ReadonlyArray<SponsorUnityLayerDescriptor>,
): SponsorUnityLineage {
  const entries: SponsorUnityLineageEntry[] = [];
  let cumulative = '';
  descriptors.forEach((d, i) => {
    cumulative = signObject({ prev: cumulative, sig: d.descriptorSignature, index: i });
    entries.push(
      Object.freeze({
        index: i,
        id: d.id,
        phase: d.phase,
        descriptorSignature: d.descriptorSignature,
        cumulativeSignature: cumulative,
      }),
    );
  });
  const lineageSignature = signObject(entries.map((e) => e.cumulativeSignature));
  const terminalSignature = entries.length
    ? entries[entries.length - 1].cumulativeSignature
    : signObject({ empty: true });
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    lineageSignature,
    terminalSignature,
  });
}
