/**
 * Phase 1.9.26 — Sponsor World Snapshot.
 */
import { deepFreeze, signObject } from './sponsorWorldInternals';
import type { SponsorUnifiedWorldState } from './sponsorUnifiedWorldState';
import type { SponsorWorldStateCompositionGraph } from './sponsorWorldCompositionGraph';
import type { SponsorWorldLineage } from './sponsorWorldLineage';

export interface SponsorWorldSnapshot {
  readonly version: 'v1';
  readonly stateSignature: string;
  readonly compositionSignature: string;
  readonly lineageSignature: string;
  readonly snapshotSignature: string;
}

export function generateWorldSnapshot(
  state: SponsorUnifiedWorldState,
  composition: SponsorWorldStateCompositionGraph,
  lineage: SponsorWorldLineage,
): SponsorWorldSnapshot {
  const snapshotSignature = signObject({
    v: 'v1',
    state: state.stateSignature,
    composition: composition.graphSignature,
    lineage: lineage.lineageSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    stateSignature: state.stateSignature,
    compositionSignature: composition.graphSignature,
    lineageSignature: lineage.lineageSignature,
    snapshotSignature,
  });
}
