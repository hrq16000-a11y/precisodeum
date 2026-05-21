/**
 * Phase 1.9.36 — Sponsor Saturation Lineage.
 */
import { deepFreeze, signObject } from './sponsorEquilibriumInternals';
import type { SponsorEquilibriumLayerDescriptor } from './sponsorUniversalSaturationProofs';

export interface SponsorSaturationLineageEntry {
  readonly index: number;
  readonly id: SponsorEquilibriumLayerDescriptor['id'];
  readonly phase: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorSaturationLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorSaturationLineageEntry>;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
}

export function computeSaturationLineage(
  descriptors: ReadonlyArray<SponsorEquilibriumLayerDescriptor>,
): SponsorSaturationLineage {
  const entries: SponsorSaturationLineageEntry[] = [];
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
