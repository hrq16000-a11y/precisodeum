/**
 * Fase 1.7.7 — Consistency comparator (READ-ONLY).
 *
 * Compara consistency requirements entre legacy e atomic plans.
 */

import { OPERATION_REGISTRY, type FlowId } from '@/lib/operations/operationRegistry';
import type { ConsistencyLevel } from '@/lib/atomicBlueprint/atomicBlueprintTypes';
import { simulateFlow } from './simulateAtomicExecution';

export interface ConsistencyComparison {
  flow: FlowId;
  legacy: ConsistencyLevel[];
  atomic: ConsistencyLevel[];
  shared: ConsistencyLevel[];
  legacyOnly: ConsistencyLevel[];
  atomicOnly: ConsistencyLevel[];
  matches: boolean;
}

export function compareConsistency(flow: FlowId): ConsistencyComparison | null {
  const sim = simulateFlow(flow);
  if (!sim) return null;
  const legacy = sim.legacy.consistency;
  const atomic = sim.atomic.consistency;
  const shared = legacy.filter((c) => atomic.includes(c));
  const legacyOnly = legacy.filter((c) => !atomic.includes(c));
  const atomicOnly = atomic.filter((c) => !legacy.includes(c));
  return {
    flow,
    legacy,
    atomic,
    shared,
    legacyOnly,
    atomicOnly,
    matches: legacyOnly.length === 0 && atomicOnly.length === 0,
  };
}

export function compareAllConsistency(): Record<FlowId, ConsistencyComparison> {
  const out = {} as Record<FlowId, ConsistencyComparison>;
  for (const r of OPERATION_REGISTRY) {
    const cmp = compareConsistency(r.flow);
    if (cmp) out[r.flow] = cmp;
  }
  return out;
}
