/**
 * Phase 1.9.39 — Sponsor Closure-Unity Lineage.
 */
import { deepFreeze, signObject } from './sponsorClosureUnityInternals';
import type { SponsorClosureUnityLayerDescriptor } from './sponsorSelfContainmentProofs';

export interface SponsorClosureUnityLineageEntry {
  readonly index: number;
  readonly layerId: string;
  readonly phase: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorClosureUnityLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorClosureUnityLineageEntry>;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
}

export function computeClosureUnityLineage(
  descriptors: ReadonlyArray<SponsorClosureUnityLayerDescriptor>,
): SponsorClosureUnityLineage {
  const entries: SponsorClosureUnityLineageEntry[] = [];
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
