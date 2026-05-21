/**
 * Phase 1.9.26 — Sponsor Unified World State Layer.
 * Top-level orchestrator. Composes 1.9.14 → 1.9.25 snapshots into a single
 * deterministic, immutable, replayable world envelope.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorWorldDeterminismError } from './sponsorWorldInternals';
import {
  buildUnifiedWorldState,
  type SponsorUnifiedWorldState,
  type SponsorWorldLayerInput,
} from './sponsorUnifiedWorldState';
import {
  resolveCompositionGraph,
  type SponsorWorldStateCompositionGraph,
} from './sponsorWorldCompositionGraph';
import { computeWorldLineage, type SponsorWorldLineage } from './sponsorWorldLineage';
import { generateWorldSnapshot, type SponsorWorldSnapshot } from './sponsorWorldSnapshot';
import { buildWorldRegistry, type SponsorWorldRegistry } from './sponsorWorldRegistry';
import {
  buildWorldEnvelope,
  lockWorldEnvelope,
  type SponsorDeterministicWorldEnvelope,
} from './sponsorDeterministicWorldEnvelope';

export interface SponsorUnifiedWorldStateResult {
  readonly registry: SponsorWorldRegistry;
  readonly state: SponsorUnifiedWorldState;
  readonly composition: SponsorWorldStateCompositionGraph;
  readonly lineage: SponsorWorldLineage;
  readonly snapshot: SponsorWorldSnapshot;
  readonly envelope: SponsorDeterministicWorldEnvelope;
}

export function runUnifiedWorldStateLayer(
  inputs: ReadonlyArray<SponsorWorldLayerInput> = [],
): SponsorUnifiedWorldStateResult {
  const registry = buildWorldRegistry();
  const state = buildUnifiedWorldState(inputs);
  const composition = resolveCompositionGraph(state);
  const lineage = computeWorldLineage(state);
  const snapshot = generateWorldSnapshot(state, composition, lineage);
  const envelope = buildWorldEnvelope(registry, state, composition, lineage, snapshot);
  lockWorldEnvelope(envelope);
  return Object.freeze({ registry, state, composition, lineage, snapshot, envelope });
}

export function composeWorldSnapshots(
  inputs: ReadonlyArray<SponsorWorldLayerInput>,
): SponsorWorldSnapshot {
  return runUnifiedWorldStateLayer(inputs).snapshot;
}

export function assertWorldDeterminism(
  a: SponsorDeterministicWorldEnvelope,
  b: SponsorDeterministicWorldEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorWorldDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorWorldDeterminismError('snapshot signature drift');
  }
  if (a.state.stateSignature !== b.state.stateSignature) {
    throw new SponsorWorldDeterminismError('state signature drift');
  }
  if (a.composition.graphSignature !== b.composition.graphSignature) {
    throw new SponsorWorldDeterminismError('composition signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorWorldDeterminismError('lineage signature drift');
  }
  if (a.registry.registrySignature !== b.registry.registrySignature) {
    throw new SponsorWorldDeterminismError('registry signature drift');
  }
}
