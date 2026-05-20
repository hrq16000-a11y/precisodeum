/**
 * Fase 1.8.8 — Immutable topology (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  ImmutableBoundary,
  ImmutableSeverity,
  ImmutableViolation,
} from './immutableTypes';

export interface TopologySignal {
  readonly flow: FlowId;
  readonly boundaries: readonly ImmutableBoundary[];
  readonly overlaps?: number;
  readonly recursive?: boolean;
  readonly leakDetected?: boolean;
}

export interface ImmutableTopologyAnalysis {
  readonly flow: FlowId;
  readonly layers: number;
  readonly overlaps: number;
  readonly recursive: boolean;
  readonly riskScore: number; // 0..1
  readonly violations: readonly ImmutableViolation[];
}

export function detectTopologyInstability(s: TopologySignal): ImmutableViolation | null {
  if ((s.overlaps ?? 0) <= 2) return null;
  const layer = s.boundaries[0]?.layer ?? 'enforcement';
  return {
    flow: s.flow, layer, type: 'topology_instability',
    severity: 'HIGH', detail: 'topology_instability_detected',
  };
}

export function detectRecursiveTopologyUnlock(s: TopologySignal): ImmutableViolation | null {
  if (!s.recursive) return null;
  const layer = s.boundaries[0]?.layer ?? 'enforcement';
  return {
    flow: s.flow, layer, type: 'recursive_runtime_unlock',
    severity: 'CRITICAL', detail: 'recursive_topology_unlock',
  };
}

export function detectTopologyLeak(s: TopologySignal): ImmutableViolation | null {
  if (!s.leakDetected) return null;
  const layer = s.boundaries[0]?.layer ?? 'enforcement';
  return {
    flow: s.flow, layer, type: 'cross_layer_side_effect',
    severity: 'MEDIUM', detail: 'topology_leak_detected',
  };
}

export function rankImmutableTopologyRisk(a: ImmutableTopologyAnalysis): ImmutableSeverity {
  if (a.recursive) return 'CRITICAL';
  if (a.overlaps > 3) return 'HIGH';
  if (a.overlaps > 0) return 'MEDIUM';
  return 'NONE';
}

export function analyzeImmutableTopology(s: TopologySignal): ImmutableTopologyAnalysis {
  const violations: ImmutableViolation[] = [];
  const a = detectTopologyInstability(s); if (a) violations.push(a);
  const b = detectRecursiveTopologyUnlock(s); if (b) violations.push(b);
  const c = detectTopologyLeak(s); if (c) violations.push(c);
  const layers = s.boundaries.length;
  const overlaps = s.overlaps ?? 0;
  const recursive = !!s.recursive;
  const riskScore = Math.max(0, Math.min(1,
    (recursive ? 0.5 : 0) + Math.min(0.5, overlaps * 0.15)));
  return { flow: s.flow, layers, overlaps, recursive, riskScore, violations };
}
