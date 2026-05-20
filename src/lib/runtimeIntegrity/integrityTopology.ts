/**
 * Fase 1.8.5 — Integrity topology (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  IntegrityLayerKind,
  RuntimeIntegrityBoundary,
  RuntimeIntegrityLayer,
  RuntimeIntegrityTopology,
} from './integrityTypes';

export interface TopologyInput {
  readonly flow: FlowId;
  readonly layers: readonly RuntimeIntegrityLayer[];
  readonly boundaries: readonly RuntimeIntegrityBoundary[];
  readonly recursive?: boolean;
}

export function buildIntegrityTopology(input: TopologyInput): RuntimeIntegrityTopology {
  const gapCount = input.layers.filter((l) => !l.intact || l.gaps > 0).length;
  const leaking = input.boundaries.some((b) => !b.intact);
  return {
    flow: input.flow,
    layers: input.layers,
    boundaries: input.boundaries,
    gapCount,
    recursive: !!input.recursive,
    leaking,
  };
}

export function detectTopologyIntegrityGap(t: RuntimeIntegrityTopology): boolean {
  return t.gapCount > 0;
}
export function detectTopologyLeak(t: RuntimeIntegrityTopology): boolean {
  return t.leaking;
}
export function detectTopologyRecursion(t: RuntimeIntegrityTopology): boolean {
  return t.recursive;
}
export function classifyTopologyIntegrity(t: RuntimeIntegrityTopology): 'safe' | 'risky' | 'unsafe' {
  if (t.recursive) return 'unsafe';
  if (t.leaking || t.gapCount > 0) return 'risky';
  return 'safe';
}

export function buildIntactLayer(flow: FlowId, kind: IntegrityLayerKind): RuntimeIntegrityLayer {
  return { flow, kind, intact: true, score: 1, gaps: 0 };
}
