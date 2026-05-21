/**
 * Phase 1.9.25 — Sponsor Topology Registry.
 * Canonical lookup over layers/phases. Read-only.
 */
import {
  SPONSOR_TOPOLOGY_LAYER_ORDER,
  SPONSOR_TOPOLOGY_LAYER_PHASE,
  SPONSOR_TOPOLOGY_LAYER_PLANE,
  deepFreeze,
  signObject,
  type SponsorTopologyLayerId,
  type SponsorTopologyPlane,
} from './sponsorTopologyInternals';

export interface SponsorTopologyRegistryEntry {
  readonly layer: SponsorTopologyLayerId;
  readonly phase: string;
  readonly plane: SponsorTopologyPlane;
  readonly entrySignature: string;
}

export interface SponsorTopologyRegistry {
  readonly entries: ReadonlyArray<SponsorTopologyRegistryEntry>;
  readonly registrySignature: string;
}

export function buildTopologyRegistry(): SponsorTopologyRegistry {
  const entries: SponsorTopologyRegistryEntry[] = SPONSOR_TOPOLOGY_LAYER_ORDER.map((layer) => {
    const phase = SPONSOR_TOPOLOGY_LAYER_PHASE[layer];
    const plane = SPONSOR_TOPOLOGY_LAYER_PLANE[layer];
    return Object.freeze({
      layer,
      phase,
      plane,
      entrySignature: signObject({ layer, phase, plane }),
    });
  });
  const registrySignature = signObject(entries.map((e) => e.entrySignature));
  return deepFreeze({ entries: Object.freeze(entries), registrySignature });
}
