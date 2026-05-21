/**
 * Phase 1.9.35 — Sponsor Completeness Lineage.
 */
import { deepFreeze, signObject } from './sponsorCoherenceInternals';
import type { SponsorCoherenceLayerDescriptor } from './sponsorOntologicalCompletenessProofs';

export interface SponsorCompletenessLineageEntry {
  readonly index: number;
  readonly id: SponsorCoherenceLayerDescriptor['id'];
  readonly phase: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorCompletenessLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorCompletenessLineageEntry>;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
}

export function computeCompletenessLineage(
  descriptors: ReadonlyArray<SponsorCoherenceLayerDescriptor>,
): SponsorCompletenessLineage {
  const entries: SponsorCompletenessLineageEntry[] = [];
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
