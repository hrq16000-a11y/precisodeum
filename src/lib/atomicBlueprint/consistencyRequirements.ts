/**
 * Fase 1.7.6 — Consistency requirements (READ-ONLY).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import type { ConsistencyLevel } from './atomicBlueprintTypes';

export function deriveConsistencyRequirements(
  reg: FlowRegistration,
): ConsistencyLevel[] {
  const profile = getFlowDriftProfile(reg.flow);
  const out = new Set<ConsistencyLevel>();
  if (reg.steps.length === 1) out.add('strong');
  if (reg.supportsAtomic && reg.steps.length > 1) out.add('strong');
  if (profile?.depends_on_eventual_sync) out.add('eventual');
  if (profile?.depends_on_mirror) out.add('mirror');
  if (reg.ownership !== 'profile' && reg.ownership !== 'provider') out.add('ownership');
  if (reg.requiresFinalize) out.add('finalize');
  if (reg.requiresProgressSync) out.add('onboarding');
  if (reg.boundary === 'adminWriteBoundary') out.add('admin');
  return Array.from(out);
}

export function getAllConsistencyRequirements(): Record<FlowId, ConsistencyLevel[]> {
  const out = {} as Record<FlowId, ConsistencyLevel[]>;
  for (const r of OPERATION_REGISTRY) out[r.flow] = deriveConsistencyRequirements(r);
  return out;
}
