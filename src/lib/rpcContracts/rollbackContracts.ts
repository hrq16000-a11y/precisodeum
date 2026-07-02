/**
 * Fase 1.7.9 — Rollback contracts (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { getRollbackStrategy } from '@/lib/atomicBlueprint/rollbackStrategies';
import type { RpcRollbackContract, RpcStrength } from './rpcContractTypes';

const STRATEGY_TO_CLASS: Record<
  string,
  RpcRollbackContract['classification']
> = {
  compensating_write: 'compensating',
  safe_retry: 'retry_safe',
  noop_rollback: 'none',
  hard_abort: 'transactional_ready',
  partial_visibility: 'compensating',
  delayed_reconciliation: 'weak',
};

const CLASS_TO_STRENGTH: Record<
  RpcRollbackContract['classification'],
  RpcStrength
> = {
  none: 'NONE',
  weak: 'WEAK',
  compensating: 'PARTIAL',
  retry_safe: 'STRONG',
  transactional_ready: 'FULL',
};

export function buildRollbackContract(flow: FlowId): RpcRollbackContract | null {
  const r = getRollbackStrategy(flow);
  if (!r) return null;
  const classification = STRATEGY_TO_CLASS[r.strategy] ?? 'weak';
  return {
    flow,
    strategy: r.strategy,
    classification,
    strength: CLASS_TO_STRENGTH[classification],
    requiresCompensation:
      classification === 'compensating' ||
      classification === 'transactional_ready',
    supportsSafeRetry:
      classification === 'retry_safe' ||
      classification === 'transactional_ready',
    supportsVisibilityRevert:
      classification === 'transactional_ready' ||
      classification === 'compensating',
  };
}

export function calculateRollbackStrength(flow: FlowId): RpcStrength {
  return buildRollbackContract(flow)?.strength ?? 'NONE';
}

export function requiresCompensation(flow: FlowId): boolean {
  return buildRollbackContract(flow)?.requiresCompensation ?? false;
}

export function supportsSafeRetry(flow: FlowId): boolean {
  return buildRollbackContract(flow)?.supportsSafeRetry ?? false;
}

export function supportsRollbackVisibility(flow: FlowId): boolean {
  return buildRollbackContract(flow)?.supportsVisibilityRevert ?? false;
}
