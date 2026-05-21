/**
 * Phase 1.9.30 — Sponsor Specification Lineage.
 * Cumulative signed chain across execution-semantic descriptors.
 */
import { deepFreeze, signObject } from './sponsorSpecificationInternals';
import type { SponsorExecutionSemanticDescriptor } from './sponsorExecutionSemantics';

export interface SponsorSpecificationLineageEntry {
  readonly index: number;
  readonly layer: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorSpecificationLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorSpecificationLineageEntry>;
  readonly lineageSignature: string;
}

export function computeSpecificationLineage(
  descriptors: ReadonlyArray<SponsorExecutionSemanticDescriptor>,
): SponsorSpecificationLineage {
  let prev = '';
  const entries: SponsorSpecificationLineageEntry[] = descriptors.map((d, index) => {
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
