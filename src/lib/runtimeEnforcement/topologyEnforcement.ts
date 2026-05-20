/**
 * Fase 1.8.7 — Topology enforcement (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  EnforcementBoundary,
  EnforcementLayer,
  EnforcementSeverity,
  EnforcementViolation,
} from './enforcementTypes';

export interface TopologySignal {
  readonly flow: FlowId;
  readonly boundaries: readonly EnforcementBoundary[];
  readonly overlaps?: number;
  readonly recursive?: boolean;
  readonly mutationRisk?: boolean;
}

export interface TopologyAnalysis {
  readonly flow: FlowId;
  readonly layers: number;
  readonly overlaps: number;
  readonly recursive: boolean;
  readonly violations: readonly EnforcementViolation[];
  readonly riskScore: number; // 0..1
}

export function detectUnsafeTopology(s: TopologySignal): EnforcementViolation | null {
  const unsafe = (s.overlaps ?? 0) > 2;
  if (!unsafe) return null;
  const layer: EnforcementLayer = s.boundaries[0]?.layer ?? 'isolation';
  return {
    flow: s.flow, layer, type: 'unsafe_topology',
    severity: 'HIGH', detail: 'unsafe_topology_detected',
  };
}

export function detectRecursiveTopology(s: TopologySignal): EnforcementViolation | null {
  if (!s.recursive) return null;
  const layer: EnforcementLayer = s.boundaries[0]?.layer ?? 'isolation';
  return {
    flow: s.flow, layer, type: 'recursive_runtime',
    severity: 'HIGH', detail: 'recursive_topology_detected',
  };
}

export function detectTopologyMutationRisk(s: TopologySignal): EnforcementViolation | null {
  if (!s.mutationRisk) return null;
  const layer: EnforcementLayer = s.boundaries[0]?.layer ?? 'isolation';
  return {
    flow: s.flow, layer, type: 'implicit_mutation',
    severity: 'MEDIUM', detail: 'topology_mutation_risk',
  };
}

export function rankTopologyEnforcementRisk(a: TopologyAnalysis): EnforcementSeverity {
  if (a.recursive || a.overlaps > 3) return 'CRITICAL';
  if (a.overlaps > 2) return 'HIGH';
  if (a.overlaps > 0) return 'MEDIUM';
  return 'NONE';
}

export function analyzeEnforcementTopology(s: TopologySignal): TopologyAnalysis {
  const violations: EnforcementViolation[] = [];
  const a = detectUnsafeTopology(s); if (a) violations.push(a);
  const b = detectRecursiveTopology(s); if (b) violations.push(b);
  const c = detectTopologyMutationRisk(s); if (c) violations.push(c);
  const layers = s.boundaries.length;
  const overlaps = s.overlaps ?? 0;
  const recursive = !!s.recursive;
  const riskScore = Math.max(0, Math.min(1,
    (recursive ? 0.5 : 0) + Math.min(0.5, overlaps * 0.15)));
  return { flow: s.flow, layers, overlaps, recursive, violations, riskScore };
}
