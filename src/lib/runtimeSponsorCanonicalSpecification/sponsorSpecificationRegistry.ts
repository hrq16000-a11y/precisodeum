/**
 * Phase 1.9.30 — Sponsor Specification Registry.
 * Canonical, frozen registry of layer specs included in the specification plane.
 */
import {
  SPONSOR_SPECIFICATION_LAYERS,
  deepFreeze,
  signObject,
  type SponsorSpecificationLayerSpec,
} from './sponsorSpecificationInternals';

export interface SponsorSpecificationRegistry {
  readonly version: 'v1';
  readonly layers: ReadonlyArray<SponsorSpecificationLayerSpec>;
  readonly registrySignature: string;
}

export function buildSpecificationRegistry(): SponsorSpecificationRegistry {
  const layers = SPONSOR_SPECIFICATION_LAYERS.map((l) => Object.freeze({ ...l }));
  const registrySignature = signObject(
    layers.map((l) => ({
      layer: l.layer,
      phase: l.phase,
      plane: l.plane,
      semantics: l.semantics,
    })),
  );
  return deepFreeze({
    version: 'v1' as const,
    layers: Object.freeze(layers),
    registrySignature,
  });
}
