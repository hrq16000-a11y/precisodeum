/**
 * Phase 1.9.32 — Sponsor Deterministic Closure Snapshot.
 */
import { deepFreeze, signObject } from './sponsorClosureInternals';
import type { SponsorConsistencyTheoremRegistry } from './sponsorConsistencyTheorems';
import type { SponsorTerminalConsistencyProofs } from './sponsorTerminalConsistencyProofs';
import type { SponsorClosureTheoremGraph } from './sponsorClosureTheoremGraph';
import type { SponsorClosureLineage } from './sponsorClosureLineage';

export interface SponsorDeterministicClosureSnapshot {
  readonly version: 'v1';
  readonly theoremsSignature: string;
  readonly proofsSignature: string;
  readonly descriptorsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly snapshotSignature: string;
}

export function generateClosureSnapshot(
  theorems: SponsorConsistencyTheoremRegistry,
  proofs: SponsorTerminalConsistencyProofs,
  graph: SponsorClosureTheoremGraph,
  lineage: SponsorClosureLineage,
): SponsorDeterministicClosureSnapshot {
  const snapshotSignature = signObject({
    t: theorems.theoremsSignature,
    p: proofs.proofsSignature,
    d: proofs.descriptorsSignature,
    g: graph.graphSignature,
    l: lineage.lineageSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    theoremsSignature: theorems.theoremsSignature,
    proofsSignature: proofs.proofsSignature,
    descriptorsSignature: proofs.descriptorsSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    snapshotSignature,
  });
}
