/**
 * Fase 1.8.5 — Integrity propagation (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  IntegrityPropagationKind,
  RuntimeIntegrityPropagation,
} from './integrityTypes';

const MAX_DEPTH: Record<IntegrityPropagationKind, number> = {
  owner: 2,
  mirrors: 3,
  finalize: 2,
  onboarding: 4,
  progress: 3,
  avatar: 2,
  admin: 3,
  replay: 5,
  causality: 4,
  stability: 4,
  eventual_sync: 5,
};

export interface PropagationInput {
  readonly flow: FlowId;
  readonly kind: IntegrityPropagationKind;
  readonly depth: number;
  readonly hiddenLeaks?: number;
  readonly recursive?: boolean;
  readonly circular?: boolean;
}

export function buildIntegrityPropagation(input: PropagationInput): RuntimeIntegrityPropagation {
  const max = MAX_DEPTH[input.kind];
  const leaking = input.depth > max || (input.hiddenLeaks ?? 0) > 0;
  return {
    flow: input.flow,
    kind: input.kind,
    depth: input.depth,
    leaking,
    recursive: !!input.recursive,
    circular: !!input.circular,
  };
}

export function detectPropagationIntegrityLeak(p: RuntimeIntegrityPropagation): boolean {
  return p.leaking;
}
export function detectRecursiveIntegrityPropagation(p: RuntimeIntegrityPropagation): boolean {
  return p.recursive;
}
export function detectCircularIntegrityPropagation(p: RuntimeIntegrityPropagation): boolean {
  return p.circular;
}
export function classifyPropagationIntegrity(p: RuntimeIntegrityPropagation): 'safe' | 'risky' | 'unsafe' {
  if (p.circular || p.recursive) return 'unsafe';
  if (p.leaking) return 'risky';
  return 'safe';
}

export function buildDefaultIntegrityPropagation(
  flow: FlowId,
  depth: number,
): readonly RuntimeIntegrityPropagation[] {
  const kinds: IntegrityPropagationKind[] = [
    'owner', 'mirrors', 'finalize', 'onboarding', 'progress',
    'avatar', 'admin', 'replay', 'causality', 'stability', 'eventual_sync',
  ];
  return kinds.map((k) => buildIntegrityPropagation({ flow, kind: k, depth }));
}
