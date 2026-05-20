/**
 * Fase 1.8.6 — Topology isolation (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  IsolationBoundary,
  IsolationLeak,
  IsolationTopology,
} from './isolationTypes';
import { detectRecursiveIsolationFailure } from './boundaryIsolation';

export interface TopologyInput {
  readonly flow: FlowId;
  readonly boundaries: readonly IsolationBoundary[];
}

export function analyzeIsolationTopology(input: TopologyInput): IsolationTopology {
  const overlaps = detectTopologyOverlap(input.boundaries);
  const recursive = detectTopologyRecursion(input.boundaries);
  const unsafeCoupling = detectUnsafeTopologyCoupling(input.boundaries);
  return {
    flow: input.flow,
    boundaries: input.boundaries,
    overlaps,
    recursive,
    unsafeCoupling,
  };
}

export function detectTopologyOverlap(boundaries: readonly IsolationBoundary[]): number {
  let overlaps = 0;
  for (const b of boundaries) overlaps += b.sharedWith.length;
  return overlaps;
}

export function detectUnsafeTopologyCoupling(boundaries: readonly IsolationBoundary[]): boolean {
  // Coupling inseguro: boundaries críticas (GOVERNANCE/PROMOTION/CERTIFICATION) compartilhadas.
  const critical = new Set(['GOVERNANCE', 'PROMOTION', 'CERTIFICATION']);
  for (const b of boundaries) {
    if (critical.has(b.type) && b.sharedWith.length > 0) return true;
    for (const s of b.sharedWith) if (critical.has(s)) return true;
  }
  return false;
}

export function detectTopologyRecursion(boundaries: readonly IsolationBoundary[]): boolean {
  return detectRecursiveIsolationFailure({ boundaries });
}

export function rankTopologyRisk(topologies: readonly IsolationTopology[]): readonly IsolationTopology[] {
  return [...topologies].sort((a, b) => {
    const ra = (a.recursive ? 100 : 0) + (a.unsafeCoupling ? 50 : 0) + a.overlaps;
    const rb = (b.recursive ? 100 : 0) + (b.unsafeCoupling ? 50 : 0) + b.overlaps;
    if (rb !== ra) return rb - ra;
    return a.flow.localeCompare(b.flow);
  });
}

export function detectTopologyOverlapLeak(flow: FlowId, t: IsolationTopology): IsolationLeak | null {
  if (t.overlaps === 0 && !t.unsafeCoupling) return null;
  return {
    flow,
    type: 'topology_overlap',
    severity: t.unsafeCoupling ? 'HIGH' : t.overlaps > 2 ? 'MEDIUM' : 'LOW',
    boundaries: t.boundaries.map((b) => b.type),
    detail: `Topology overlaps=${t.overlaps} unsafe=${t.unsafeCoupling}.`,
  };
}
