/**
 * Fase 1.7.8 — Promotion observability (READ-ONLY, fail-soft, PII-free).
 *
 * Wraps logAuditAction. Nunca envia email/phone/city/cpf/cnpj/url/raw payload.
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  PromotionConfidence,
  PromotionRollbackClass,
  PromotionRisk,
  PromotionStageId,
} from './promotionTypes';
import type { BlastRadiusLevel } from '@/lib/atomicSimulation/simulationTypes';

export type PromotionObservabilityAction =
  | 'atomic_promotion_evaluated'
  | 'promotion_blocked'
  | 'promotion_candidate_ranked'
  | 'unsafe_stage_transition_detected'
  | 'promotion_confidence_changed';

export interface PromotionEventPayload {
  source: string;
  flow: FlowId;
  stage: PromotionStageId;
  confidence: PromotionConfidence;
  blocker_count: number;
  rollback_class: PromotionRollbackClass;
  risk_level: PromotionRisk;
  parity_band: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  blast_radius: BlastRadiusLevel;
  execution_mode: 'shadow' | 'pilot' | 'soft' | 'full' | 'read_only';
}

const PII_KEYS = [
  'email',
  'phone',
  'city',
  'cpf',
  'cnpj',
  'url',
  'raw',
  'payload',
];

function stripPii<T extends Record<string, unknown>>(p: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    const lk = k.toLowerCase();
    if (PII_KEYS.some((pk) => lk.includes(pk))) continue;
    out[k] = v;
  }
  return out as T;
}

export function parityBand(score: number): PromotionEventPayload['parity_band'] {
  if (score >= 90) return 'VERY_HIGH';
  if (score >= 75) return 'HIGH';
  if (score >= 55) return 'MEDIUM';
  return 'LOW';
}

export async function emitPromotionEvent(
  action: PromotionObservabilityAction,
  payload: PromotionEventPayload,
): Promise<void> {
  try {
    const safe = stripPii(payload as unknown as Record<string, unknown>);
    await logAuditAction({
      action,
      resource_type: 'atomic_promotion',
      resource_id: payload.flow,
      details: safe,
    });
  } catch {
    // fail-soft — observabilidade nunca quebra app
  }
}

export function isPayloadPiiFree(p: Record<string, unknown>): boolean {
  for (const k of Object.keys(p)) {
    const lk = k.toLowerCase();
    if (PII_KEYS.some((pk) => lk.includes(pk))) return false;
  }
  return true;
}
