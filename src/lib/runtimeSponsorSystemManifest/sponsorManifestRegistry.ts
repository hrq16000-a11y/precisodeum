/**
 * Phase 1.9.29 — Sponsor Manifest Registry.
 * Canonical, frozen registry of layer specs exposed by the manifest plane.
 */
import {
  SPONSOR_MANIFEST_LAYERS,
  deepFreeze,
  signObject,
  type SponsorManifestLayerSpec,
} from './sponsorManifestInternals';

export interface SponsorManifestRegistry {
  readonly version: 'v1';
  readonly layers: ReadonlyArray<SponsorManifestLayerSpec>;
  readonly registrySignature: string;
}

export function buildManifestRegistry(): SponsorManifestRegistry {
  const layers = SPONSOR_MANIFEST_LAYERS.map((l) => Object.freeze({ ...l }));
  const registrySignature = signObject(
    layers.map((l) => ({ layer: l.layer, phase: l.phase, plane: l.plane })),
  );
  return deepFreeze({
    version: 'v1' as const,
    layers: Object.freeze(layers),
    registrySignature,
  });
}
