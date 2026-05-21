/**
 * Phase 1.9.25 — Sponsor Topology Snapshot.
 */
import { deepFreeze, signObject } from './sponsorTopologyInternals';
import type { SponsorSystemTopologyGraph } from './sponsorSystemTopologyGraph';
import type { SponsorExecutionDependencyGraph } from './sponsorExecutionDependencyGraph';
import type { SponsorTopologyLineage } from './sponsorTopologyLineage';

export interface SponsorTopologySnapshot {
  readonly snapshotVersion: 'v1';
  readonly topologyGraphSignature: string;
  readonly executionGraphSignature: string;
  readonly lineageSignature: string;
  readonly snapshotSignature: string;
}

export function generateTopologySnapshot(
  topology: SponsorSystemTopologyGraph,
  execution: SponsorExecutionDependencyGraph,
  lineage: SponsorTopologyLineage,
): SponsorTopologySnapshot {
  const snapshotSignature = signObject({
    v: 'v1',
    topology: topology.graphSignature,
    execution: execution.graphSignature,
    lineage: lineage.lineageSignature,
  });
  return deepFreeze({
    snapshotVersion: 'v1' as const,
    topologyGraphSignature: topology.graphSignature,
    executionGraphSignature: execution.graphSignature,
    lineageSignature: lineage.lineageSignature,
    snapshotSignature,
  });
}
