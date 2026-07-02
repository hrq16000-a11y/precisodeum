/**
 * Fase 1.7.9 — Consistency contracts (READ-ONLY, pure).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { simulateFlow } from '@/lib/atomicSimulation/simulateAtomicExecution';
import type { ConsistencyLevel } from '@/lib/atomicBlueprint/atomicBlueprintTypes';
import type { RpcConsistencyGuarantee, RpcStrength } from './rpcContractTypes';

export function calculateConsistencyStrength(
  levels: ConsistencyLevel[],
): RpcStrength {
  if (levels.length === 0) return 'NONE';
  const hasStrong = levels.includes('strong');
  const hasEventual = levels.includes('eventual');
  const hasMirror = levels.includes('mirror');
  if (hasStrong && !hasEventual && !hasMirror) return 'FULL';
  if (hasStrong && hasMirror && !hasEventual) return 'STRONG';
  if (hasStrong) return 'PARTIAL';
  if (hasMirror || levels.length >= 2) return 'WEAK';
  return 'PARTIAL';
}

export function buildConsistencyContract(
  flow: FlowId,
): RpcConsistencyGuarantee | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  const sim = simulateFlow(flow);
  const levels = sim?.atomic.consistency ?? [];
  const profile = getFlowDriftProfile(flow);
  return {
    flow,
    level: levels,
    strength: calculateConsistencyStrength(levels),
    requiresMirrorPropagation: !!profile?.depends_on_mirror,
    requiresOwnershipResolution:
      reg.ownership === 'mixed' || levels.includes('ownership'),
    supportsEventualConsistency:
      !!profile?.depends_on_eventual_sync || levels.includes('eventual'),
  };
}

export function requiresMirrorPropagation(flow: FlowId): boolean {
  return buildConsistencyContract(flow)?.requiresMirrorPropagation ?? false;
}

export function requiresOwnershipResolution(flow: FlowId): boolean {
  return buildConsistencyContract(flow)?.requiresOwnershipResolution ?? false;
}

export function supportsEventualConsistency(flow: FlowId): boolean {
  return buildConsistencyContract(flow)?.supportsEventualConsistency ?? false;
}
