/**
 * Phase 1.9.48 — Safety envelope.
 */
import {
  createDeterministicEnvelope,
  type DeterministicEnvelope,
  type DeterministicSnapshot,
} from '@/lib/runtimeSponsorMetaPlaneRuntime';
import type { SafetySnapshotPayload } from './sponsorSafetySnapshot';

export interface SafetyEnvelopePayload {
  readonly snapshotSignature: string;
  readonly runtimeSignature: string;
  readonly decisionSignature: string;
  readonly interdictionSignature: string;
  readonly vetoGraphSignature: string;
  readonly killSwitchGraphSignature: string;
  readonly proofsSignature: string;
  readonly lineageSignature: string;
}

export function buildSafetyEnvelope(
  snapshot: DeterministicSnapshot<SafetySnapshotPayload>,
): DeterministicEnvelope<SafetyEnvelopePayload> {
  return createDeterministicEnvelope<SafetyEnvelopePayload>({
    snapshotSignature: snapshot.snapshotSignature,
    runtimeSignature: snapshot.payload.runtimeSignature,
    decisionSignature: snapshot.payload.decisionSignature,
    interdictionSignature: snapshot.payload.interdictionSignature,
    vetoGraphSignature: snapshot.payload.vetoGraphSignature,
    killSwitchGraphSignature: snapshot.payload.killSwitchGraphSignature,
    proofsSignature: snapshot.payload.proofsSignature,
    lineageSignature: snapshot.payload.lineageSignature,
  });
}
