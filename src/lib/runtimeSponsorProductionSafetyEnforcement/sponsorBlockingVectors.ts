/**
 * Phase 1.9.48 — Blocking vectors (read-only).
 */
import { SAFETY_BLOCKING_VECTORS, type SponsorSafetyBlockingVector } from './sponsorSafetyInternals';

export interface SponsorBlockingVectorEntry {
  readonly vector: SponsorSafetyBlockingVector;
  readonly defaultDecision: 'BLOCK';
  readonly canBypass: false;
}

export const SPONSOR_BLOCKING_VECTORS: ReadonlyArray<SponsorBlockingVectorEntry> = Object.freeze(
  SAFETY_BLOCKING_VECTORS.map((v) =>
    Object.freeze({ vector: v, defaultDecision: 'BLOCK' as const, canBypass: false as const }),
  ),
);
