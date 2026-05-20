/**
 * Fase 1.8.6 — Boundary isolation (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  IsolationBoundary,
  IsolationBoundaryType,
  IsolationClassification,
  IsolationLeak,
  IsolationSeverity,
} from './isolationTypes';

export interface BoundaryInput {
  readonly flow: FlowId;
  readonly type: IsolationBoundaryType;
  readonly sharedWith?: readonly IsolationBoundaryType[];
  readonly intact?: boolean;
}

export function buildBoundary(input: BoundaryInput): IsolationBoundary {
  const sharedWith = input.sharedWith ?? [];
  return {
    flow: input.flow,
    type: input.type,
    intact: input.intact ?? sharedWith.length === 0,
    sharedWith,
  };
}

export function classifyBoundaryIsolation(input: {
  boundaries: readonly IsolationBoundary[];
  recursive: boolean;
  cascading: boolean;
  liveExecutionEnabled?: boolean;
  currentStage?: string;
}): IsolationClassification {
  if (input.liveExecutionEnabled) return 'COLLAPSED';
  if (input.currentStage && input.currentStage !== 'STAGE_0_READ_ONLY') return 'LEAKING';
  if (input.recursive && input.cascading) return 'COLLAPSED';
  if (input.recursive) return 'LEAKING';
  const broken = input.boundaries.filter((b) => !b.intact).length;
  const shared = input.boundaries.filter((b) => b.sharedWith.length > 0).length;
  if (broken >= 2) return 'LEAKING';
  if (broken === 1) return 'BOUNDARY_SHARED';
  if (shared > 0) return 'CONTAINED';
  return 'FULLY_ISOLATED';
}

export function detectBoundaryLeak(flow: FlowId, b: IsolationBoundary): IsolationLeak | null {
  if (b.intact && b.sharedWith.length === 0) return null;
  const severity: IsolationSeverity = !b.intact ? 'HIGH' : b.sharedWith.length > 1 ? 'MEDIUM' : 'LOW';
  return {
    flow,
    type: !b.intact ? 'shared_boundary' : 'cross_layer_dependency',
    severity,
    boundaries: [b.type, ...b.sharedWith],
    detail: !b.intact ? `Boundary ${b.type} rompido.` : `Boundary ${b.type} compartilhado.`,
  };
}

export function detectCrossLayerDependency(boundaries: readonly IsolationBoundary[]): boolean {
  return boundaries.some((b) => b.sharedWith.length > 0);
}

export function detectRecursiveIsolationFailure(input: {
  boundaries: readonly IsolationBoundary[];
}): boolean {
  // Recursão = um boundary compartilha com outro que também compartilha de volta.
  const map = new Map<IsolationBoundaryType, IsolationBoundary>();
  for (const b of input.boundaries) map.set(b.type, b);
  for (const b of input.boundaries) {
    for (const s of b.sharedWith) {
      const other = map.get(s);
      if (other && other.sharedWith.includes(b.type)) return true;
    }
  }
  return false;
}

export function detectSharedBoundaryRisk(boundaries: readonly IsolationBoundary[]): boolean {
  return boundaries.filter((b) => b.sharedWith.length > 0).length >= 2;
}

export function detectIsolationCollapse(input: {
  recursive: boolean;
  cascading: boolean;
  liveExecutionEnabled?: boolean;
}): boolean {
  if (input.liveExecutionEnabled) return true;
  return input.recursive && input.cascading;
}
