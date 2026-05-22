/**
 * Phase 1.9.40 — Sponsor Omega Lineage.
 */
import { deepFreeze, signObject } from './sponsorOmegaInternals';
import type { SponsorOmegaLayerDescriptor } from './sponsorIrreducibleCompletenessProofs';

export interface SponsorOmegaLineageEntry {
  readonly index: number;
  readonly layerId: string;
  readonly phase: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorOmegaLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorOmegaLineageEntry>;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
}

export function computeOmegaLineage(
  descriptors: ReadonlyArray<SponsorOmegaLayerDescriptor>,
): SponsorOmegaLineage {
  const entries: SponsorOmegaLineageEntry[] = [];
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
