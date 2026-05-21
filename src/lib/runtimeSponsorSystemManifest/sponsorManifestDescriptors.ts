/**
 * Phase 1.9.29 — Sponsor Manifest Descriptors.
 * Per-layer descriptors synthesized from upstream signatures (read-only).
 */
import {
  SPONSOR_MANIFEST_LAYERS,
  SPONSOR_MANIFEST_LAYER_ORDER,
  deepFreeze,
  signObject,
  type SponsorManifestLayerId,
  type SponsorManifestPlane,
} from './sponsorManifestInternals';

export interface SponsorManifestLayerInput {
  readonly layer: SponsorManifestLayerId;
  readonly signature?: string | null;
}

export interface SponsorManifestDescriptor {
  readonly layer: SponsorManifestLayerId;
  readonly phase: string;
  readonly plane: SponsorManifestPlane;
  readonly description: string;
  readonly signature: string | null;
  readonly present: boolean;
  readonly descriptorSignature: string;
}

export function generateManifestDescriptors(
  inputs: ReadonlyArray<SponsorManifestLayerInput> = [],
): ReadonlyArray<SponsorManifestDescriptor> {
  const byLayer = new Map<SponsorManifestLayerId, string | null>();
  for (const inp of inputs) {
    if (!SPONSOR_MANIFEST_LAYER_ORDER.includes(inp.layer)) continue;
    byLayer.set(inp.layer, inp.signature ?? null);
  }
  const descriptors: SponsorManifestDescriptor[] = SPONSOR_MANIFEST_LAYERS.map((spec) => {
    const signature = byLayer.has(spec.layer) ? byLayer.get(spec.layer) ?? null : null;
    const present = signature !== null && signature !== '';
    return Object.freeze({
      layer: spec.layer,
      phase: spec.phase,
      plane: spec.plane,
      description: spec.description,
      signature,
      present,
      descriptorSignature: signObject({
        layer: spec.layer,
        phase: spec.phase,
        plane: spec.plane,
        signature,
        present,
      }),
    });
  });
  return deepFreeze(Object.freeze(descriptors));
}
