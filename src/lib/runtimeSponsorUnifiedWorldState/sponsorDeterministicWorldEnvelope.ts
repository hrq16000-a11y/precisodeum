/**
 * Phase 1.9.26 — Sponsor Deterministic World Envelope.
 */
import {
  SponsorWorldMutationError,
  SPONSOR_WORLD_INTERNALS,
  deepFreeze,
  signObject,
} from './sponsorWorldInternals';
import type { SponsorUnifiedWorldState } from './sponsorUnifiedWorldState';
import type { SponsorWorldStateCompositionGraph } from './sponsorWorldCompositionGraph';
import type { SponsorWorldLineage } from './sponsorWorldLineage';
import type { SponsorWorldSnapshot } from './sponsorWorldSnapshot';
import type { SponsorWorldRegistry } from './sponsorWorldRegistry';

export interface SponsorDeterministicWorldEnvelope {
  readonly envelopeVersion: 'v1';
  readonly registry: SponsorWorldRegistry;
  readonly state: SponsorUnifiedWorldState;
  readonly composition: SponsorWorldStateCompositionGraph;
  readonly lineage: SponsorWorldLineage;
  readonly snapshot: SponsorWorldSnapshot;
  readonly envelopeSignature: string;
  readonly locked: true;
}

export function buildWorldEnvelope(
  registry: SponsorWorldRegistry,
  state: SponsorUnifiedWorldState,
  composition: SponsorWorldStateCompositionGraph,
  lineage: SponsorWorldLineage,
  snapshot: SponsorWorldSnapshot,
): SponsorDeterministicWorldEnvelope {
  const envelopeSignature = signObject({
    v: 'v1',
    registry: registry.registrySignature,
    state: state.stateSignature,
    composition: composition.graphSignature,
    lineage: lineage.lineageSignature,
    snapshot: snapshot.snapshotSignature,
  });
  return deepFreeze({
    envelopeVersion: 'v1' as const,
    registry,
    state,
    composition,
    lineage,
    snapshot,
    envelopeSignature,
    locked: true as const,
  });
}

export function lockWorldEnvelope(env: SponsorDeterministicWorldEnvelope): void {
  if (!env.locked) throw new SponsorWorldMutationError('envelope is not locked');
  if (!Object.isFrozen(env)) throw new SponsorWorldMutationError('envelope not frozen');
  if (SPONSOR_WORLD_INTERNALS.upstreamMutationAllowed !== false) {
    throw new SponsorWorldMutationError('upstream mutation flag must be false');
  }
  if (SPONSOR_WORLD_INTERNALS.postLockMutationAllowed !== false) {
    throw new SponsorWorldMutationError('post-lock mutation flag must be false');
  }
}
