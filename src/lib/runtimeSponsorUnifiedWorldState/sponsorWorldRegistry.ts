/**
 * Phase 1.9.26 — Sponsor World Registry.
 * Canonical layer registry over the 12 upstream layers.
 */
import {
  SPONSOR_WORLD_LAYER_ORDER,
  SPONSOR_WORLD_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorWorldLayerId,
} from './sponsorWorldInternals';

export interface SponsorWorldRegistryEntry {
  readonly layer: SponsorWorldLayerId;
  readonly phase: string;
  readonly entrySignature: string;
}

export interface SponsorWorldRegistry {
  readonly entries: ReadonlyArray<SponsorWorldRegistryEntry>;
  readonly registrySignature: string;
}

export function buildWorldRegistry(): SponsorWorldRegistry {
  const entries: SponsorWorldRegistryEntry[] = SPONSOR_WORLD_LAYER_ORDER.map((layer) => {
    const phase = SPONSOR_WORLD_LAYER_PHASE[layer];
    return Object.freeze({
      layer,
      phase,
      entrySignature: signObject({ layer, phase }),
    });
  });
  const registrySignature = signObject(entries.map((e) => e.entrySignature));
  return deepFreeze({ entries: Object.freeze(entries), registrySignature });
}
