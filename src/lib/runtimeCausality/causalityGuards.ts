/**
 * Fase 1.8.3 — Causality guards (READ-ONLY).
 *
 * Asserts independentes. Cada função devolve uma lista de violations
 * (vazia quando OK). Nunca lança, nunca persiste, nunca executa.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  CausalityAuditAction,
  CausalityAuditPayload,
} from './causalityObservability';
import { isCausalityAuditPayloadPiiFree } from './causalityObservability';
import type {
  RuntimeCausalityGraph,
  RuntimeCausalityViolation,
} from './causalityTypes';

export function assertCausalityCoverage(
  graphs: readonly RuntimeCausalityGraph[],
  expectedFlows: readonly FlowId[],
): RuntimeCausalityViolation[] {
  const present = new Set(graphs.map((g) => g.flow));
  const out: RuntimeCausalityViolation[] = [];
  for (const f of expectedFlows) {
    if (!present.has(f)) {
      out.push({ flow: f, code: 'missing_causality_flow', detail: `Sem causality graph para ${f}` });
    }
  }
  return out;
}

export function assertNoCircularCausalityLeaks(
  g: RuntimeCausalityGraph,
): RuntimeCausalityViolation[] {
  const out: RuntimeCausalityViolation[] = [];
  if (g.classification === 'circular' && g.severity !== 'CRITICAL') {
    out.push({ flow: g.flow, code: 'circular_cascade', detail: 'Cascata circular sem severidade crítica' });
  }
  if (g.topology.cycles && g.severity === 'NONE') {
    out.push({ flow: g.flow, code: 'circular_cascade', detail: 'Topologia cíclica sem severidade' });
  }
  return out;
}

export function assertNoUnsafePropagation(
  g: RuntimeCausalityGraph,
): RuntimeCausalityViolation[] {
  const out: RuntimeCausalityViolation[] = [];
  if (g.classification === 'recursive' && g.propagation.mode !== 'recursive') {
    out.push({ flow: g.flow, code: 'recursive_cascade', detail: 'Cascata recursiva incoerente' });
  }
  if (g.classification === 'hidden' && g.topology.hiddenDependencies === false) {
    out.push({ flow: g.flow, code: 'hidden_dependency_unbounded', detail: 'Dependência oculta não confirmada na topologia' });
  }
  return out;
}

export function assertReplayCausalityIntegrity(
  g: RuntimeCausalityGraph,
): RuntimeCausalityViolation[] {
  const out: RuntimeCausalityViolation[] = [];
  if (g.replay.regression && g.severity !== 'CRITICAL') {
    out.push({ flow: g.flow, code: 'replay_causality_divergence', detail: 'Regressão de replay sem severidade crítica' });
  }
  return out;
}

export function assertDriftContainment(
  g: RuntimeCausalityGraph,
): RuntimeCausalityViolation[] {
  const out: RuntimeCausalityViolation[] = [];
  if (g.drift.unbounded && g.severity !== 'CRITICAL') {
    out.push({ flow: g.flow, code: 'drift_uncontained', detail: 'Drift não contido sem severidade crítica' });
  }
  return out;
}

export function assertObservabilityPurity(
  payloads: readonly CausalityAuditPayload[],
  allowedActions: readonly CausalityAuditAction[],
): RuntimeCausalityViolation[] {
  const out: RuntimeCausalityViolation[] = [];
  const allowed = new Set<CausalityAuditAction>(allowedActions);
  for (const p of payloads) {
    if (!allowed.has(p.action)) {
      out.push({ flow: p.flow, code: 'observability_pii_leak', detail: `Ação não permitida: ${p.action}` });
    }
    if (!isCausalityAuditPayloadPiiFree(p)) {
      out.push({ flow: p.flow, code: 'observability_pii_leak', detail: 'Payload com PII detectado' });
    }
  }
  return out;
}

export function assertNoUnsafeCausalityPromotion(
  g: RuntimeCausalityGraph,
): RuntimeCausalityViolation[] {
  const out: RuntimeCausalityViolation[] = [];
  if (g.liveExecutionEnabled !== false) {
    out.push({ flow: g.flow, code: 'live_execution_attempted', detail: 'liveExecution não é false' });
  }
  if (g.retryEnabled !== false) {
    out.push({ flow: g.flow, code: 'retry_attempted', detail: 'retry não é false' });
  }
  if (g.backgroundEnabled !== false) {
    out.push({ flow: g.flow, code: 'background_attempted', detail: 'background não é false' });
  }
  if (g.currentStage !== 'STAGE_0_READ_ONLY') {
    out.push({ flow: g.flow, code: 'unsafe_causality_promotion', detail: 'Stage diferente de STAGE_0_READ_ONLY' });
  }
  if (g.blast.escalated && g.severity !== 'CRITICAL') {
    out.push({ flow: g.flow, code: 'unsafe_blast_escalation', detail: 'Blast escalado sem severidade crítica' });
  }
  return out;
}
