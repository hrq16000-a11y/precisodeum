/**
 * Phase 1.9.20 — Sponsor Surface · Stability validator.
 * Asserts cross-node and cross-cache determinism. Fail-closed.
 */
import type { SponsorAPIResponse } from '@/lib/runtimeSponsorAPIProductIntegrationLayer';
import type { SponsorEdgeConsistencyEnvelope } from './sponsorEdgeConsistencyEnvelope';
import { computeEdgeFingerprint, fingerprintsMatch } from './sponsorDistributedCacheFingerprint';
import { SponsorSurfaceStabilityError } from './sponsorSurfaceInternals';

export function assertResponseStructurallyLocked(response: SponsorAPIResponse): void {
  if (!response.locked) throw new SponsorSurfaceStabilityError('response not locked');
  if (!Object.isFrozen(response)) throw new SponsorSurfaceStabilityError('response not frozen');
  if (!Object.isFrozen(response.body)) throw new SponsorSurfaceStabilityError('body not frozen');
  if (!Object.isFrozen(response.headers))
    throw new SponsorSurfaceStabilityError('headers not frozen');
  if (response.headers.deterministic !== true)
    throw new SponsorSurfaceStabilityError('headers.deterministic must be true');
  if (response.headers.readonly !== true)
    throw new SponsorSurfaceStabilityError('headers.readonly must be true');
}

/** Validates that two envelopes for the same (contract, request) tuple match bit-a-bit. */
export function assertCrossNodeDeterminism(
  a: SponsorEdgeConsistencyEnvelope,
  b: SponsorEdgeConsistencyEnvelope,
): void {
  if (a.idempotencyKey.digest !== b.idempotencyKey.digest) {
    throw new SponsorSurfaceStabilityError(
      `idempotency drift: ${a.idempotencyKey.digest} ≠ ${b.idempotencyKey.digest}`,
    );
  }
  if (a.stabilityToken !== b.stabilityToken) {
    throw new SponsorSurfaceStabilityError(
      `stability token drift: ${a.stabilityToken} ≠ ${b.stabilityToken}`,
    );
  }
  if (!fingerprintsMatch(a.fingerprint, b.fingerprint)) {
    throw new SponsorSurfaceStabilityError('fingerprint drift between nodes');
  }
}

/** Recompute fingerprint from the wrapped response and confirm it matches the stored one. */
export function assertEnvelopeFingerprintIntegrity(env: SponsorEdgeConsistencyEnvelope): void {
  const recomputed = computeEdgeFingerprint(env.response);
  if (!fingerprintsMatch(recomputed, env.fingerprint)) {
    throw new SponsorSurfaceStabilityError('envelope fingerprint mismatch (drift detected)');
  }
}

/** Asserts envelope and inner response are fully locked/frozen. */
export function assertEnvelopeLocked(env: SponsorEdgeConsistencyEnvelope): void {
  if (!env.locked) throw new SponsorSurfaceStabilityError('envelope not locked');
  if (!Object.isFrozen(env)) throw new SponsorSurfaceStabilityError('envelope not frozen');
  assertResponseStructurallyLocked(env.response);
}
