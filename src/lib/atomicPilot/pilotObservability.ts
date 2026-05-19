/**
 * Fase 1.7.10 — Pilot observability (READ-ONLY, fail-soft, PII-free).
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  AtomicPilotStage,
  PilotExecutionMode,
  PilotPromotionPolicy,
  PilotRiskLevel,
  PilotRollbackClass,
} from './pilotTypes';
import type { BlastRadiusLevel } from '@/lib/atomicSimulation/simulationTypes';

export type PilotObservabilityAction =
  | 'atomic_pilot_candidate_detected'
  | 'pilot_rollout_blocked'
  | 'pilot_abort_strategy_generated'
  | 'kill_switch_trigger_detected'
  | 'pilot_readiness_changed'
  | 'unsafe_pilot_candidate_detected';

export interface PilotEventPayload {
  source: string;
  flow: FlowId;
  stage: AtomicPilotStage;
  rollout_class: PilotPromotionPolicy;
  rollback_class: PilotRollbackClass;
  blast_radius: BlastRadiusLevel;
  confidence: number; // 0..100
  blocker_count: number;
  execution_mode: PilotExecutionMode;
  risk: PilotRiskLevel;
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
  'json',
  'address',
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

export function isPilotPayloadPiiFree(p: Record<string, unknown>): boolean {
  for (const k of Object.keys(p)) {
    const lk = k.toLowerCase();
    if (PII_KEYS.some((pk) => lk.includes(pk))) return false;
  }
  return true;
}

export async function emitPilotEvent(
  action: PilotObservabilityAction,
  payload: PilotEventPayload,
): Promise<void> {
  try {
    const safe = stripPii(payload as unknown as Record<string, unknown>);
    await logAuditAction({
      action,
      resource_type: 'atomic_pilot',
      resource_id: payload.flow,
      details: safe,
    });
  } catch {
    // fail-soft — never breaks app
  }
}
