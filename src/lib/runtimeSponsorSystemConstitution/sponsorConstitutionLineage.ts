/**
 * Phase 1.9.31 — Sponsor Constitution Lineage.
 * Cumulative signed chain across constitutional layer descriptors.
 */
import { deepFreeze, signObject } from './sponsorConstitutionInternals';
import type { SponsorConstitutionLayerDescriptor } from './sponsorConstitutionGraph';

export interface SponsorConstitutionLineageEntry {
  readonly index: number;
  readonly layer: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorConstitutionLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorConstitutionLineageEntry>;
  readonly lineageSignature: string;
}

export function computeConstitutionLineage(
  descriptors: ReadonlyArray<SponsorConstitutionLayerDescriptor>,
): SponsorConstitutionLineage {
  let prev = '';
  const entries: SponsorConstitutionLineageEntry[] = descriptors.map((d, index) => {
    const cumulativeSignature = signObject({
      prev,
      layer: d.layer,
      sig: d.descriptorSignature,
    });
    prev = cumulativeSignature;
    return Object.freeze({
      index,
      layer: d.layer,
      descriptorSignature: d.descriptorSignature,
      cumulativeSignature,
    });
  });
  const lineageSignature = signObject(entries.map((e) => e.cumulativeSignature));
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    lineageSignature,
  });
}
