/**
 * Fase 1.8.5 — Integrity containment (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  IntegrityContainment,
  IntegrityRisk,
  RuntimeIntegrityContainment,
} from './integrityTypes';

export interface ContainmentInput {
  readonly flow: FlowId;
  readonly origin: RuntimeIntegrityContainment['origin'];
  readonly leakedSteps: number;
  readonly totalSteps: number;
  readonly cascading?: boolean;
  readonly unbounded?: boolean;
}

export function classifyContainmentRisk(c: RuntimeIntegrityContainment): IntegrityRisk {
  switch (c.containment) {
    case 'contained': return 'none';
    case 'partially_contained': return 'low';
    case 'leaking': return c.cascading ? 'high' : 'medium';
    case 'cascading': return 'high';
    case 'unbounded': return 'critical';
  }
}

export function calculateContainmentDepth(c: ContainmentInput): number {
  if (c.totalSteps === 0) return 0;
  return Math.min(c.totalSteps, c.leakedSteps + (c.cascading ? 1 : 0));
}

function classify(input: ContainmentInput): IntegrityContainment {
  if (input.unbounded) return 'unbounded';
  if (input.cascading) return 'cascading';
  if (input.totalSteps === 0 || input.leakedSteps === 0) return 'contained';
  if (input.leakedSteps >= input.totalSteps) return 'unbounded';
  if (input.leakedSteps / input.totalSteps >= 0.5) return 'leaking';
  return 'partially_contained';
}

function build(input: ContainmentInput): RuntimeIntegrityContainment {
  return {
    flow: input.flow,
    origin: input.origin,
    containment: classify(input),
    depth: calculateContainmentDepth(input),
    cascading: !!input.cascading,
  };
}

export function detectPropagationContainment(input: Omit<ContainmentInput, 'origin'>): RuntimeIntegrityContainment {
  return build({ ...input, origin: 'propagation' });
}
export function detectReplayContainment(input: Omit<ContainmentInput, 'origin'>): RuntimeIntegrityContainment {
  return build({ ...input, origin: 'replay' });
}
export function detectDriftContainment(input: Omit<ContainmentInput, 'origin'>): RuntimeIntegrityContainment {
  return build({ ...input, origin: 'drift' });
}
export function detectMirrorContainment(input: Omit<ContainmentInput, 'origin'>): RuntimeIntegrityContainment {
  return build({ ...input, origin: 'mirror' });
}
export function detectFinalizeContainment(input: Omit<ContainmentInput, 'origin'>): RuntimeIntegrityContainment {
  return build({ ...input, origin: 'finalize' });
}

export function detectCascadingIntegrityFailure(
  containments: readonly RuntimeIntegrityContainment[],
): boolean {
  const escalated = containments.filter((c) => c.containment === 'cascading' || c.containment === 'unbounded');
  return escalated.length >= 2;
}
