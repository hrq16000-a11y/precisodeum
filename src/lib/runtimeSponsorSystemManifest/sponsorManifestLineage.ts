/**
 * Phase 1.9.29 — Sponsor Manifest Lineage.
 * Cumulative signed chain of descriptors providing auditable manifest history.
 */
import { deepFreeze, signObject } from './sponsorManifestInternals';
import type { SponsorManifestDescriptor } from './sponsorManifestDescriptors';

export interface SponsorManifestLineageEntry {
  readonly index: number;
  readonly layer: string;
  readonly descriptorSignature: string;
  readonly cumulativeSignature: string;
}

export interface SponsorManifestLineage {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorManifestLineageEntry>;
  readonly lineageSignature: string;
}

export function computeManifestLineage(
  descriptors: ReadonlyArray<SponsorManifestDescriptor>,
): SponsorManifestLineage {
  let prev = '';
  const entries: SponsorManifestLineageEntry[] = descriptors.map((d, index) => {
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
