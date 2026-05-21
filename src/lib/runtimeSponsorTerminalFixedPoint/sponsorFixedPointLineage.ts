/**
 * Phase 1.9.33 — Sponsor Fixed-Point Lineage.
 */
import { deepFreeze, signObject } from './sponsorFixedPointInternals';
import type { SponsorFixedPointLayerDescriptor } from './sponsorTerminalImmutabilityProofs';

export interface SponsorFixedPointLineageEntry {
  readonly index: number;
  readonly layerId: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorFixedPointLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorFixedPointLineageEntry>;
  readonly terminalSignature: string;
  readonly lineageSignature: string;
}

export function computeFixedPointLineage(
  descriptors: ReadonlyArray<SponsorFixedPointLayerDescriptor>,
): SponsorFixedPointLineage {
  const entries: SponsorFixedPointLineageEntry[] = [];
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
  const terminalSignature = cumulative;
  const lineageSignature = signObject(entries.map((e) => e.cumulativeSignature));
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    terminalSignature,
    lineageSignature,
  });
}
