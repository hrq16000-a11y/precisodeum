/**
 * Phase 1.9.26 — Sponsor Unified World State.
 * Pure read-only composition of per-layer snapshot signatures.
 */
import {
  SPONSOR_WORLD_LAYER_ORDER,
  SPONSOR_WORLD_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorWorldLayerId,
} from './sponsorWorldInternals';

/** Loose snapshot input: any object exposing a stable `signature`. */
export interface SponsorWorldLayerInput {
  readonly layer: SponsorWorldLayerId;
  readonly signature?: string | null;
}

export interface SponsorUnifiedWorldStateEntry {
  readonly layer: SponsorWorldLayerId;
  readonly phase: string;
  readonly signature: string | null;
  readonly entrySignature: string;
}

export interface SponsorUnifiedWorldState {
  readonly version: 'v1';
  readonly entries: ReadonlyArray<SponsorUnifiedWorldStateEntry>;
  readonly stateSignature: string;
}

export function buildUnifiedWorldState(
  inputs: ReadonlyArray<SponsorWorldLayerInput> = [],
): SponsorUnifiedWorldState {
  const byLayer = new Map<SponsorWorldLayerId, string | null>();
  for (const l of SPONSOR_WORLD_LAYER_ORDER) byLayer.set(l, null);
  for (const inp of inputs) {
    if (!SPONSOR_WORLD_LAYER_PHASE[inp.layer]) continue;
    byLayer.set(inp.layer, inp.signature ?? null);
  }

  const entries: SponsorUnifiedWorldStateEntry[] = SPONSOR_WORLD_LAYER_ORDER.map((layer) => {
    const signature = byLayer.get(layer) ?? null;
    const phase = SPONSOR_WORLD_LAYER_PHASE[layer];
    return Object.freeze({
      layer,
      phase,
      signature,
      entrySignature: signObject({ layer, phase, signature }),
    });
  });

  const stateSignature = signObject(entries.map((e) => e.entrySignature));
  return deepFreeze({
    version: 'v1' as const,
    entries: Object.freeze(entries),
    stateSignature,
  });
}
