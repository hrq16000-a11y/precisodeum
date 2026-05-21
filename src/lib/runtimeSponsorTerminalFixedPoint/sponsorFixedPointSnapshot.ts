/**
 * Phase 1.9.33 — Sponsor Deterministic Fixed-Point Snapshot.
 */
import { deepFreeze, signObject } from './sponsorFixedPointInternals';
import type { SponsorFixedPointConsensusRegistry } from './sponsorFixedPointConsensus';
import type { SponsorTerminalImmutabilityProofs } from './sponsorTerminalImmutabilityProofs';
import type { SponsorFixedPointGraph } from './sponsorFixedPointGraph';
import type { SponsorFixedPointLineage } from './sponsorFixedPointLineage';

export interface SponsorDeterministicFixedPointSnapshot {
  readonly version: 'v1';
  readonly consensusSignature: string;
  readonly proofsSignature: string;
  readonly descriptorsSignature: string;
  readonly graphSignature: string;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
  readonly snapshotSignature: string;
}

export function generateFixedPointSnapshot(
  consensus: SponsorFixedPointConsensusRegistry,
  proofs: SponsorTerminalImmutabilityProofs,
  graph: SponsorFixedPointGraph,
  lineage: SponsorFixedPointLineage,
): SponsorDeterministicFixedPointSnapshot {
  const snapshotSignature = signObject({
    c: consensus.consensusSignature,
    p: proofs.proofsSignature,
    d: proofs.descriptorsSignature,
    g: graph.graphSignature,
    l: lineage.lineageSignature,
    t: lineage.terminalSignature,
  });
  return deepFreeze({
    version: 'v1' as const,
    consensusSignature: consensus.consensusSignature,
    proofsSignature: proofs.proofsSignature,
    descriptorsSignature: proofs.descriptorsSignature,
    graphSignature: graph.graphSignature,
    lineageSignature: lineage.lineageSignature,
    terminalSignature: lineage.terminalSignature,
    snapshotSignature,
  });
}
