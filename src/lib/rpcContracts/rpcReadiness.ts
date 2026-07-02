/**
 * Fase 1.7.9 — RPC readiness scoring (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';
import { compareLegacyVsAtomic } from '@/lib/atomicSimulation/executionParity';
import { buildFlowPromotionState } from '@/lib/atomicPromotion/promotionMatrix';
import { calculatePromotionConfidence } from '@/lib/atomicPromotion/promotionEligibility';
import { getCatalogEntryByFlow, RPC_CATALOG } from './rpcCatalog';
import { buildRollbackContract } from './rollbackContracts';
import { buildIdempotencyContract } from './idempotencyContracts';
import { buildConsistencyContract } from './consistencyContracts';
import { buildPayloadContract } from './payloadContracts';
import type {
  RpcContractViolationCode,
  RpcReadinessReport,
} from './rpcContractTypes';

export function detectRpcBlockers(
  flow: FlowId,
): { code: RpcContractViolationCode; detail: string }[] {
  const out: { code: RpcContractViolationCode; detail: string }[] = [];
  const rb = buildRollbackContract(flow);
  if (!rb || rb.strength === 'NONE') {
    out.push({ code: 'missing_rollback_contract', detail: 'no rollback' });
  }
  const idem = buildIdempotencyContract(flow);
  if (!idem) {
    out.push({ code: 'missing_idempotency', detail: 'no idempotency contract' });
  }
  const payload = buildPayloadContract(flow);
  if (!payload || payload.unsafeFieldsDetected.length > 0) {
    out.push({
      code: 'unsafe_payload',
      detail: `unsafe=${payload?.unsafeFieldsDetected.join(',') ?? 'missing'}`,
    });
  }
  const consistency = buildConsistencyContract(flow);
  if (!consistency || consistency.strength === 'NONE' || consistency.strength === 'WEAK') {
    out.push({
      code: 'weak_consistency',
      detail: `strength=${consistency?.strength ?? 'NONE'}`,
    });
  }
  const promo = buildFlowPromotionState(flow);
  if (!promo || promo.maxAllowedStage === 'STAGE_0_READ_ONLY') {
    out.push({
      code: 'missing_promotion_support',
      detail: `stage=${promo?.maxAllowedStage ?? 'none'}`,
    });
  }
  const blast = calculateBlastRadius(flow);
  if (blast?.level === 'CRITICAL') {
    out.push({
      code: 'rpc_not_shadow_ready',
      detail: 'CRITICAL blast radius',
    });
  }
  return out;
}

export function calculateRpcReadiness(flow: FlowId): RpcReadinessReport | null {
  const entry = getCatalogEntryByFlow(flow);
  if (!entry) return null;
  const parity = compareLegacyVsAtomic(flow);
  const blast = calculateBlastRadius(flow);
  const promo = buildFlowPromotionState(flow);
  const confidence = calculatePromotionConfidence(flow);
  const rb = buildRollbackContract(flow);
  const idem = buildIdempotencyContract(flow);
  const cons = buildConsistencyContract(flow);
  const payload = buildPayloadContract(flow);
  const blockers = detectRpcBlockers(flow);

  let score = 100;
  score -= blockers.length * 12;
  if (blast?.level === 'CRITICAL') score -= 20;
  if (blast?.level === 'HIGH') score -= 10;
  if (parity) score = Math.min(score, Math.round((score + parity.score) / 2));
  score = Math.max(0, Math.min(100, score));

  const shadowReady = !!parity && parity.score >= 60 && blast?.level !== 'CRITICAL';
  const pilotReady =
    shadowReady &&
    !!rb &&
    rb.strength !== 'NONE' &&
    !!idem &&
    blockers.every(
      (b) =>
        b.code !== 'missing_rollback_contract' &&
        b.code !== 'unsafe_payload' &&
        b.code !== 'rpc_not_shadow_ready',
    );

  return {
    rpc: entry.rpc,
    flow,
    parityScore: parity?.score ?? 0,
    blastRadius: blast?.level ?? 'CRITICAL',
    promotion: promo?.maxAllowedStage ?? 'STAGE_0_READ_ONLY',
    rollbackOk: !!rb && rb.strength !== 'NONE',
    idempotencyOk: !!idem,
    consistencyOk: !!cons && cons.strength !== 'NONE' && cons.strength !== 'WEAK',
    payloadOk: !!payload && payload.unsafeFieldsDetected.length === 0,
    blockers,
    readinessScore: score,
    confidence,
    shadowReady,
    pilotReady,
  };
}

export function calculateRpcConfidence(flow: FlowId): number {
  return calculateRpcReadiness(flow)?.readinessScore ?? 0;
}

export function explainRpcReadiness(report: RpcReadinessReport): string {
  return `[RPC-READY] ${report.rpc} score=${report.readinessScore} parity=${report.parityScore} blast=${report.blastRadius} stage=${report.promotion} shadow=${report.shadowReady} pilot=${report.pilotReady} blockers=${report.blockers.length}`;
}

export function buildAllRpcReadiness(): RpcReadinessReport[] {
  const out: RpcReadinessReport[] = [];
  for (const e of RPC_CATALOG) {
    const r = calculateRpcReadiness(e.flow);
    if (r) out.push(r);
  }
  return out;
}
