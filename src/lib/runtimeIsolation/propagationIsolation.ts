/**
 * Fase 1.8.6 — Propagation isolation (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  IsolationLeak,
  IsolationPropagation,
  IsolationPropagationClassification,
} from './isolationTypes';

export interface PropagationInput {
  readonly flow: FlowId;
  readonly depth: number;
  readonly maxDepth?: number;
  readonly hiddenCascade?: boolean;
  readonly leaking?: boolean;
  readonly recursive?: boolean;
}

export function classifyPropagationEnvelope(input: PropagationInput): IsolationPropagationClassification {
  const max = input.maxDepth ?? 5;
  if (input.hiddenCascade && input.recursive) return 'collapsed';
  if (input.depth > max) return 'leaking';
  if (input.hiddenCascade) return 'leaking';
  if (input.leaking) return 'shared';
  if (input.depth >= max - 1) return 'contained';
  return 'isolated';
}

export function analyzePropagationIsolation(input: PropagationInput): IsolationPropagation {
  const classification = classifyPropagationEnvelope(input);
  const unbounded = (input.depth > (input.maxDepth ?? 5)) || classification === 'collapsed';
  return {
    flow: input.flow,
    classification,
    depth: input.depth,
    unbounded,
    hiddenCascade: !!input.hiddenCascade,
  };
}

export function detectPropagationLeak(p: IsolationPropagation): IsolationLeak | null {
  if (p.classification === 'isolated' || p.classification === 'contained') return null;
  return {
    flow: p.flow,
    type: p.unbounded ? 'unbounded_propagation' : p.hiddenCascade ? 'hidden_cascade' : 'recursive_propagation',
    severity: p.classification === 'collapsed' ? 'CRITICAL' : p.unbounded ? 'HIGH' : 'MEDIUM',
    boundaries: [],
    detail: `Propagação ${p.classification} (depth=${p.depth}).`,
  };
}

export function detectUnboundedPropagation(p: IsolationPropagation): boolean {
  return p.unbounded;
}

export function detectHiddenCascadePropagation(p: IsolationPropagation): boolean {
  return p.hiddenCascade;
}
