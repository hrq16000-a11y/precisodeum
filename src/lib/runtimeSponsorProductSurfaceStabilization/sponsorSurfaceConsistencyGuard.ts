/**
 * Phase 1.9.20 — Sponsor Surface · Consistency guard.
 * Stateless enforcement of envelope integrity. No mutation. No I/O.
 */
import type { SponsorEdgeConsistencyEnvelope } from './sponsorEdgeConsistencyEnvelope';
import {
  assertEnvelopeFingerprintIntegrity,
  assertEnvelopeLocked,
} from './sponsorResponseStabilityValidator';
import { SponsorSurfaceStabilityError } from './sponsorSurfaceInternals';

export function validateConsistencyEnvelope(env: SponsorEdgeConsistencyEnvelope): void {
  assertEnvelopeLocked(env);
  assertEnvelopeFingerprintIntegrity(env);
  // Cross-check: response cacheKey/etag must match the fingerprint.
  if (env.response.headers.etag !== env.fingerprint.etag) {
    throw new SponsorSurfaceStabilityError('etag mismatch between response and fingerprint');
  }
  if (env.response.headers.cacheKey !== env.fingerprint.cacheKey) {
    throw new SponsorSurfaceStabilityError('cacheKey mismatch between response and fingerprint');
  }
}

/** Asserts cache-hit vs cache-miss envelopes produce identical structural output. */
export function resolveDistributedCacheParity(
  hit: SponsorEdgeConsistencyEnvelope,
  miss: SponsorEdgeConsistencyEnvelope,
): void {
  if (hit.fingerprint.compositeFingerprint !== miss.fingerprint.compositeFingerprint) {
    throw new SponsorSurfaceStabilityError(
      'cache parity violated: hit and miss diverge structurally',
    );
  }
  if (hit.stabilityToken !== miss.stabilityToken) {
    throw new SponsorSurfaceStabilityError(
      'cache parity violated: stabilityToken diverges between hit and miss',
    );
  }
}
