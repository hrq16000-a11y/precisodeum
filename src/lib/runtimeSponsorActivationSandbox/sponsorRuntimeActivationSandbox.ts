/**
 * Phase 1.9.47 — SponsorRuntimeActivationSandbox orchestrator.
 */
import { deepFreeze, assertEnvelopeDeterminism, assertSnapshotIntegrity } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { simulateActivationFlow } from './sponsorSandboxExecutionRuntime';
import { buildSandboxExecutionGraph } from './sponsorSandboxExecutionGraph';
import { buildSandboxDependencyTopology } from './sponsorSandboxDependencyTopology';
import { buildSandboxProofs } from './sponsorSandboxProofs';
import { buildSandboxLineage } from './sponsorSandboxLineage';
import { buildSandboxSnapshot } from './sponsorSandboxSnapshot';
import { buildSandboxEnvelope, type SandboxEnvelopePayload } from './sponsorSandboxEnvelope';
import type { DeterministicEnvelope } from '@/lib/runtimeSponsorMetaPlaneRuntime';

export interface SponsorRuntimeActivationSandbox {
  readonly version: 'v1';
  readonly envelope: DeterministicEnvelope<SandboxEnvelopePayload>;
  readonly sandboxSignature: string;
}

export function resolveSponsorRuntimeActivationSandbox(): SponsorRuntimeActivationSandbox {
  const flow = simulateActivationFlow();
  const executionGraph = buildSandboxExecutionGraph();
  const dependencyTopology = buildSandboxDependencyTopology();
  const proofs = buildSandboxProofs();
  const lineage = buildSandboxLineage(flow, proofs, executionGraph, dependencyTopology);
  const snapshot = buildSandboxSnapshot(flow, lineage, proofs, executionGraph, dependencyTopology);
  const envelope = buildSandboxEnvelope(snapshot);
  return deepFreeze({
    version: 'v1' as const,
    envelope,
    sandboxSignature: envelope.envelopeSignature,
  });
}

export function assertSandboxDeterminism(sb: SponsorRuntimeActivationSandbox): boolean {
  return assertEnvelopeDeterminism(sb.envelope)
    && assertSnapshotIntegrity({
      version: 'v1' as const,
      payload: sb.envelope.payload,
      snapshotSignature: sb.envelope.payload.snapshotSignature,
    } as never) !== undefined;
}
