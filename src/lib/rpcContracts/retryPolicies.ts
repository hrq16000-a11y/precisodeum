/**
 * Fase 1.7.9 — Retry policies (READ-ONLY, pure).
 *
 * Apenas declara políticas. NUNCA executa retries.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import type {
  RpcFailureClass,
  RpcRetryPolicy,
  RpcRetryPolicyKind,
} from './rpcContractTypes';
import { buildRollbackContract } from './rollbackContracts';
import { buildIdempotencyContract } from './idempotencyContracts';

function classifyRetryKind(flow: FlowId): RpcRetryPolicyKind {
  const rb = buildRollbackContract(flow);
  const idem = buildIdempotencyContract(flow);
  if (!rb || !idem) return 'manual_only';
  if (
    rb.classification === 'retry_safe' &&
    idem.deterministicReplay
  ) {
    return 'safe_retry';
  }
  if (rb.classification === 'compensating') return 'compensating_retry';
  if (rb.classification === 'transactional_ready') return 'no_retry';
  return 'manual_only';
}

export function buildRetryPolicy(flow: FlowId): RpcRetryPolicy | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  const kind = classifyRetryKind(flow);
  const failureClasses: RpcFailureClass[] = [
    'transient',
    'invariant_violation',
  ];
  if (reg.ownership === 'mixed') failureClasses.push('ownership_conflict');
  if (!buildIdempotencyContract(flow)?.deterministicReplay) {
    failureClasses.push('idempotency_violation');
  }
  if (buildRollbackContract(flow)?.requiresCompensation) {
    failureClasses.push('rollback_required');
  }
  if (reg.boundary === 'adminWriteBoundary') failureClasses.push('fatal');
  return {
    flow,
    kind,
    failureClasses,
    // Client retries são SEMPRE explícitos — esta fase nunca ativa retries.
    allowsClientRetry: kind === 'safe_retry',
    // Background retries são proibidos universalmente nesta fase.
    allowsBackgroundRetry: false,
  };
}
