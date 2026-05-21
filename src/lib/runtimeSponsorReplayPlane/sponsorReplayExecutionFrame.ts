/**
 * Phase 1.9.27 — Sponsor Replay Execution Frame.
 * A single deterministic frame reconstructed from an upstream layer snapshot.
 * READ-ONLY · ZERO MUTATION.
 */
import {
  SPONSOR_REPLAY_LAYER_ORDER,
  SPONSOR_REPLAY_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorReplayLayerId,
} from './sponsorReplayInternals';

/** Replay input: tick + per-layer signature observed at that tick. */
export interface SponsorReplayTickInput {
  readonly tick: number;
  readonly layers: ReadonlyArray<{
    readonly layer: SponsorReplayLayerId;
    readonly signature: string | null;
  }>;
}

export interface SponsorReplayExecutionFrame {
  readonly tick: number;
  readonly index: number;
  readonly layer: SponsorReplayLayerId;
  readonly phase: string;
  readonly signature: string | null;
  readonly frameSignature: string;
}

export function buildExecutionFrames(
  input: SponsorReplayTickInput,
): ReadonlyArray<SponsorReplayExecutionFrame> {
  const byLayer = new Map<SponsorReplayLayerId, string | null>();
  for (const l of SPONSOR_REPLAY_LAYER_ORDER) byLayer.set(l, null);
  for (const entry of input.layers) {
    if (!SPONSOR_REPLAY_LAYER_PHASE[entry.layer]) continue;
    byLayer.set(entry.layer, entry.signature ?? null);
  }
  const frames: SponsorReplayExecutionFrame[] = SPONSOR_REPLAY_LAYER_ORDER.map((layer, index) => {
    const signature = byLayer.get(layer) ?? null;
    const phase = SPONSOR_REPLAY_LAYER_PHASE[layer];
    return Object.freeze({
      tick: input.tick,
      index,
      layer,
      phase,
      signature,
      frameSignature: signObject({ tick: input.tick, index, layer, phase, signature }),
    });
  });
  return deepFreeze(Object.freeze(frames));
}
