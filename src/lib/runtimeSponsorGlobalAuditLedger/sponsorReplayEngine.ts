/**
 * Phase 1.9.22 — Deterministic replay engine.
 * Produces ordered frames whose signatures are bit-stable across runs.
 */
import {
  type SponsorDeterministicReplaySnapshot,
  type SponsorReplayFrame,
  type SponsorTraceCorrelationVector,
} from './sponsorAuditEnvelope';
import {
  SponsorAuditReplayDriftError,
  deepFreeze,
  signObject,
} from './sponsorAuditInternals';

export function generateReplayFrames(
  correlation: SponsorTraceCorrelationVector,
): SponsorDeterministicReplaySnapshot {
  const frames: SponsorReplayFrame[] = correlation.orderedLayers.map((layer, idx) => {
    const upstreamSignature = correlation.orderedSignatures[idx];
    const frameSignature = signObject({
      frameIndex: idx,
      layer,
      upstreamSignature,
    });
    return Object.freeze({
      frameIndex: idx,
      layer,
      upstreamSignature,
      frameSignature,
    });
  });

  const replaySignature = signObject({
    chain: correlation.chainSignature,
    frames: frames.map((f) => f.frameSignature),
  });

  return deepFreeze({
    frames: Object.freeze(frames),
    replaySignature,
  });
}

export function assertReplayDeterminism(
  a: SponsorDeterministicReplaySnapshot,
  b: SponsorDeterministicReplaySnapshot,
): void {
  if (a.replaySignature !== b.replaySignature) {
    throw new SponsorAuditReplayDriftError(
      `replaySignature drift: ${a.replaySignature} vs ${b.replaySignature}`,
    );
  }
  if (a.frames.length !== b.frames.length) {
    throw new SponsorAuditReplayDriftError(
      `frame count drift: ${a.frames.length} vs ${b.frames.length}`,
    );
  }
  for (let i = 0; i < a.frames.length; i++) {
    if (a.frames[i].frameSignature !== b.frames[i].frameSignature) {
      throw new SponsorAuditReplayDriftError(
        `frame[${i}] drift: ${a.frames[i].frameSignature} vs ${b.frames[i].frameSignature}`,
      );
    }
  }
}
