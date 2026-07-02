/**
 * Fase 1.8.4 — Propagation envelope (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  PropagationEnvelopeKind,
  RuntimeDependencyResolution,
  RuntimePropagationEnvelope,
} from './stabilityTypes';

const MAX_DEPTH_BY_KIND: Record<PropagationEnvelopeKind, number> = {
  owner: 2,
  mirrors: 3,
  finalize: 2,
  onboarding: 4,
  progress: 3,
  avatar: 2,
  admin: 3,
  replay: 5,
  eventual_sync: 5,
};

export interface PropagationEnvelopeInput {
  readonly flow: FlowId;
  readonly kind: PropagationEnvelopeKind;
  readonly resolution: RuntimeDependencyResolution;
  readonly observedDepth?: number;
}

export function buildPropagationEnvelope(input: PropagationEnvelopeInput): RuntimePropagationEnvelope {
  const depth = input.observedDepth ?? input.resolution.depth;
  const maxDepth = MAX_DEPTH_BY_KIND[input.kind];
  const overflow = depth > maxDepth;
  const recursive = input.resolution.circular;
  const boundaryLeak = input.resolution.hiddenCount > 0 && input.kind !== 'replay';
  return { flow: input.flow, kind: input.kind, depth, overflow, recursive, boundaryLeak };
}

export function classifyPropagationEnvelope(e: RuntimePropagationEnvelope): 'safe' | 'risky' | 'unsafe' {
  if (e.recursive || (e.overflow && e.boundaryLeak)) return 'unsafe';
  if (e.overflow || e.boundaryLeak) return 'risky';
  return 'safe';
}

export function detectEnvelopeOverflow(e: RuntimePropagationEnvelope): boolean {
  return e.overflow;
}

export function detectRecursiveEnvelope(e: RuntimePropagationEnvelope): boolean {
  return e.recursive;
}

export function detectPropagationBoundaryLeak(e: RuntimePropagationEnvelope): boolean {
  return e.boundaryLeak;
}

export function buildDefaultEnvelopesForFlow(
  flow: FlowId,
  resolution: RuntimeDependencyResolution,
): readonly RuntimePropagationEnvelope[] {
  const kinds: PropagationEnvelopeKind[] = [
    'owner',
    'mirrors',
    'finalize',
    'onboarding',
    'progress',
    'avatar',
    'admin',
    'replay',
    'eventual_sync',
  ];
  return kinds.map((k) => buildPropagationEnvelope({ flow, kind: k, resolution }));
}
