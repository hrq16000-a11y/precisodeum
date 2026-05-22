/**
 * Phase 1.9.47 — Sandbox dry-run proofs.
 */
import { buildProofMatrix, type CanonicalProofMatrix } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { SANDBOX_UPSTREAM_LAYERS } from './sponsorSandboxInternals';

export const SANDBOX_INVARIANTS = Object.freeze([
  'SB-NO-REAL-NETWORKING',
  'SB-NO-REAL-PERSISTENCE',
  'SB-NO-REAL-BILLING',
  'SB-NO-REAL-SCHEDULING',
  'SB-NO-REAL-MONETIZATION',
  'SB-DETERMINISTIC-EXECUTION',
  'SB-EXPOSURE-CAPS-RESPECTED',
  'SB-CONCURRENCY-CAPS-RESPECTED',
  'SB-NO-UPSTREAM-MUTATION',
] as const);

export function buildSandboxProofs(): CanonicalProofMatrix {
  const subjects = SANDBOX_UPSTREAM_LAYERS.map((l) => `layer:${l}`);
  return buildProofMatrix(subjects, [...SANDBOX_INVARIANTS]);
}
