/**
 * Phase 1.9.22 — Audit replay snapshot (integration view).
 * Pairs a replay snapshot with its enclosing audit envelope for downstream
 * consumers that need a single auditable token.
 */
import type {
  SponsorAuditEnvelope,
  SponsorDeterministicReplaySnapshot,
} from './sponsorAuditEnvelope';
import { deepFreeze, signObject } from './sponsorAuditInternals';

export interface SponsorAuditReplaySnapshot {
  readonly envelopeSignature: string;
  readonly replaySignature: string;
  readonly compositeSignature: string;
  readonly locked: true;
}

export function buildAuditReplaySnapshot(
  envelope: SponsorAuditEnvelope,
  replay: SponsorDeterministicReplaySnapshot,
): SponsorAuditReplaySnapshot {
  return deepFreeze({
    envelopeSignature: envelope.envelopeSignature,
    replaySignature: replay.replaySignature,
    compositeSignature: signObject({
      env: envelope.envelopeSignature,
      replay: replay.replaySignature,
    }),
    locked: true as const,
  });
}
