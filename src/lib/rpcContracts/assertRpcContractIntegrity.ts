/**
 * Fase 1.7.9 — Master RPC contract builder + integrity asserts (READ-ONLY).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import type {
  RpcContract,
  RpcContractViolation,
} from './rpcContractTypes';
import { RPC_CATALOG, getCatalogEntryByFlow } from './rpcCatalog';
import { buildPayloadContract } from './payloadContracts';
import { buildRollbackContract } from './rollbackContracts';
import { buildIdempotencyContract } from './idempotencyContracts';
import { buildConsistencyContract } from './consistencyContracts';
import { buildSideEffectPolicy } from './sideEffectPolicies';
import { buildRetryPolicy } from './retryPolicies';
import { buildFlowPromotionState } from '@/lib/atomicPromotion/promotionMatrix';
import { calculatePromotionConfidence } from '@/lib/atomicPromotion/promotionEligibility';
import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';
import { getCompatibilityForFlow } from './compatibilityMatrix';
import { detectRpcBlockers } from './rpcReadiness';

export function buildRpcContract(flow: FlowId): RpcContract | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  const entry = getCatalogEntryByFlow(flow);
  if (!reg || !entry) return null;
  const payload = buildPayloadContract(flow);
  const rollback = buildRollbackContract(flow);
  const idem = buildIdempotencyContract(flow);
  const cons = buildConsistencyContract(flow);
  const side = buildSideEffectPolicy(flow);
  const retry = buildRetryPolicy(flow);
  const promo = buildFlowPromotionState(flow);
  const compat = getCompatibilityForFlow(flow);
  const blast = calculateBlastRadius(flow);
  if (!payload || !rollback || !idem || !cons || !side || !retry || !promo) {
    return null;
  }
  return {
    rpc: entry.rpc,
    flow,
    boundaries: [reg.boundary],
    ownership: entry.ownership,
    requiredBuilders: entry.requiredBuilders,
    requiredTrackers: entry.requiredTrackers,
    payload,
    rollback,
    idempotency: idem,
    consistency: cons,
    sideEffects: side,
    retry,
    promotion: {
      flow,
      minStage: 'STAGE_0_READ_ONLY',
      maxStage: promo.maxAllowedStage,
      requiredConfidence: calculatePromotionConfidence(flow),
      pilotReady:
        promo.maxAllowedStage === 'STAGE_2_SOFT_PILOT' ||
        promo.maxAllowedStage === 'STAGE_3_PARTIAL_ATOMIC' ||
        promo.maxAllowedStage === 'STAGE_4_FULL_ATOMIC',
      softReady:
        promo.maxAllowedStage === 'STAGE_3_PARTIAL_ATOMIC' ||
        promo.maxAllowedStage === 'STAGE_4_FULL_ATOMIC',
      fullReady: promo.maxAllowedStage === 'STAGE_4_FULL_ATOMIC',
    },
    atomicity:
      rollback.classification === 'transactional_ready'
        ? 'fully_atomic'
        : rollback.classification === 'compensating'
          ? 'partial'
          : rollback.classification === 'retry_safe'
            ? 'transactional'
            : 'none',
    executionSemantic: 'shadow_only',
    mirrorPropagation: cons.requiresMirrorPropagation,
    driftSensitivity: blast?.level ?? 'MEDIUM',
    compatibility: compat?.compatibility ?? 'NONE',
    liveExecutionEnabled: false,
  };
}

export function buildAllRpcContracts(): RpcContract[] {
  const out: RpcContract[] = [];
  for (const e of RPC_CATALOG) {
    const c = buildRpcContract(e.flow);
    if (c) out.push(c);
  }
  return out;
}

export function assertRpcCoverage(): RpcContractViolation[] {
  const out: RpcContractViolation[] = [];
  const known = new Set(RPC_CATALOG.map((r) => r.flow));
  for (const reg of OPERATION_REGISTRY) {
    if (!known.has(reg.flow)) {
      out.push({
        code: 'missing_promotion_support',
        flow: reg.flow,
        detail: 'flow missing from RPC catalog',
      });
    }
  }
  return out;
}

export function assertRollbackCoverage(): RpcContractViolation[] {
  const out: RpcContractViolation[] = [];
  for (const e of RPC_CATALOG) {
    if (!buildRollbackContract(e.flow)) {
      out.push({
        code: 'missing_rollback_contract',
        rpc: e.rpc,
        flow: e.flow,
        detail: 'rollback contract missing',
      });
    }
  }
  return out;
}

export function assertIdempotencyCoverage(): RpcContractViolation[] {
  const out: RpcContractViolation[] = [];
  for (const e of RPC_CATALOG) {
    if (!buildIdempotencyContract(e.flow)) {
      out.push({
        code: 'missing_idempotency',
        rpc: e.rpc,
        flow: e.flow,
        detail: 'idempotency contract missing',
      });
    }
  }
  return out;
}

export function assertConsistencyCoverage(): RpcContractViolation[] {
  const out: RpcContractViolation[] = [];
  for (const e of RPC_CATALOG) {
    const c = buildConsistencyContract(e.flow);
    if (!c) {
      out.push({
        code: 'weak_consistency',
        rpc: e.rpc,
        flow: e.flow,
        detail: 'consistency contract missing',
      });
    }
  }
  return out;
}

export function assertCompatibilityCoverage(): RpcContractViolation[] {
  const out: RpcContractViolation[] = [];
  for (const e of RPC_CATALOG) {
    const row = getCompatibilityForFlow(e.flow);
    if (!row) {
      out.push({
        code: 'incompatible_boundary',
        rpc: e.rpc,
        flow: e.flow,
        detail: 'missing compatibility row',
      });
    }
  }
  return out;
}

export function assertNoUnsafeRpcPromotion(): RpcContractViolation[] {
  const out: RpcContractViolation[] = [];
  for (const c of buildAllRpcContracts()) {
    if (c.liveExecutionEnabled !== false) {
      out.push({
        code: 'rpc_not_shadow_ready',
        rpc: c.rpc,
        flow: c.flow,
        detail: 'live execution must be false in 1.7.9',
      });
    }
    if (c.executionSemantic !== 'shadow_only') {
      out.push({
        code: 'rpc_not_shadow_ready',
        rpc: c.rpc,
        flow: c.flow,
        detail: `execution semantic must be shadow_only — got ${c.executionSemantic}`,
      });
    }
    // unsafe payload escalation
    if (c.payload.unsafeFieldsDetected.length > 0) {
      out.push({
        code: 'unsafe_payload',
        rpc: c.rpc,
        flow: c.flow,
        detail: `unsafe fields: ${c.payload.unsafeFieldsDetected.join(',')}`,
      });
    }
  }
  return out;
}

export function assertRpcContractIntegrity(): RpcContractViolation[] {
  return [
    ...assertRpcCoverage(),
    ...assertRollbackCoverage(),
    ...assertIdempotencyCoverage(),
    ...assertConsistencyCoverage(),
    ...assertCompatibilityCoverage(),
    ...assertNoUnsafeRpcPromotion(),
  ];
}

export { detectRpcBlockers };
