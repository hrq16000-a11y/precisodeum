/**
 * Phase 1.9.47 — Sandbox envelope.
 */
import { createDeterministicEnvelope, type DeterministicEnvelope } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import type { DeterministicSnapshot } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import type { SandboxSnapshotPayload } from './sponsorSandboxSnapshot';

export interface SandboxEnvelopePayload {
  readonly snapshotSignature: string;
  readonly flowSignature: string;
  readonly lineageSignature: string;
  readonly proofsSignature: string;
  readonly executionGraphSignature: string;
  readonly dependencyTopologySignature: string;
}

export function buildSandboxEnvelope(
  snapshot: DeterministicSnapshot<SandboxSnapshotPayload>,
): DeterministicEnvelope<SandboxEnvelopePayload> {
  return createDeterministicEnvelope<SandboxEnvelopePayload>({
    snapshotSignature: snapshot.snapshotSignature,
    flowSignature: snapshot.payload.flowSignature,
    lineageSignature: snapshot.payload.lineageSignature,
    proofsSignature: snapshot.payload.proofsSignature,
    executionGraphSignature: snapshot.payload.executionGraphSignature,
    dependencyTopologySignature: snapshot.payload.dependencyTopologySignature,
  });
}
