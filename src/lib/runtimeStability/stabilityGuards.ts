/**
 * Fase 1.8.4 — Stability guards (READ-ONLY, never throws).
 */

import type {
  RuntimeStabilityEnvelope,
  RuntimeStabilityViolation,
} from './stabilityTypes';
import type {
  StabilityAuditAction,
  StabilityAuditPayload,
} from './stabilityObservability';
import { isStabilityAuditPayloadPiiFree } from './stabilityObservability';

export function assertDependencyCoverage(
  e: RuntimeStabilityEnvelope,
): RuntimeStabilityViolation[] {
  const out: RuntimeStabilityViolation[] = [];
  if (e.resolution.resolution === 'unresolved') {
    out.push({ flow: e.flow, code: 'unresolved_dependency', detail: 'Resolução não cobre todas as dependências.' });
  }
  return out;
}

export function assertNoCircularDependencyLeaks(
  e: RuntimeStabilityEnvelope,
): RuntimeStabilityViolation[] {
  const out: RuntimeStabilityViolation[] = [];
  if (e.resolution.circular && e.classification !== 'collapsing' && e.classification !== 'divergent') {
    out.push({ flow: e.flow, code: 'circular_dependency_leak', detail: 'Dependência circular sem classificação coerente.' });
  }
  return out;
}

export function assertNoEnvelopeOverflow(
  e: RuntimeStabilityEnvelope,
): RuntimeStabilityViolation[] {
  const out: RuntimeStabilityViolation[] = [];
  for (const p of e.propagation) {
    if (p.overflow && e.classification === 'stable') {
      out.push({ flow: e.flow, code: 'propagation_overflow', detail: `Overflow no envelope ${p.kind} em fluxo classificado estável.` });
    }
  }
  return out;
}

export function assertCollapseContainment(
  e: RuntimeStabilityEnvelope,
): RuntimeStabilityViolation[] {
  const out: RuntimeStabilityViolation[] = [];
  for (const c of e.collapse) {
    if ((c.severity === 'high' || c.severity === 'critical') && e.classification === 'stable') {
      out.push({ flow: e.flow, code: 'collapse_uncontained', detail: 'Colapso severo dentro de envelope estável.' });
    }
  }
  return out;
}

export function assertConvergenceIntegrity(
  e: RuntimeStabilityEnvelope,
): RuntimeStabilityViolation[] {
  const out: RuntimeStabilityViolation[] = [];
  if (e.convergence.divergent && e.classification !== 'divergent') {
    out.push({ flow: e.flow, code: 'convergence_divergence', detail: 'Convergência divergente sem classificação compatível.' });
  }
  return out;
}

export function assertObservabilityPurity(
  payloads: readonly StabilityAuditPayload[],
  allowedActions: readonly StabilityAuditAction[],
): RuntimeStabilityViolation[] {
  const allowed = new Set<StabilityAuditAction>(allowedActions);
  const out: RuntimeStabilityViolation[] = [];
  for (const p of payloads) {
    if (!allowed.has(p.action)) {
      out.push({ flow: p.flow, code: 'observability_pii_leak', detail: `Ação não permitida: ${p.action}` });
    }
    if (!isStabilityAuditPayloadPiiFree(p)) {
      out.push({ flow: p.flow, code: 'observability_pii_leak', detail: 'Payload contém PII.' });
    }
  }
  return out;
}

export function assertNoUnsafeStabilityPromotion(
  e: RuntimeStabilityEnvelope,
): RuntimeStabilityViolation[] {
  const out: RuntimeStabilityViolation[] = [];
  if (e.liveExecutionEnabled !== false) {
    out.push({ flow: e.flow, code: 'live_execution_attempted', detail: 'liveExecution não é false.' });
  }
  if (e.retryEnabled !== false) {
    out.push({ flow: e.flow, code: 'retry_attempted', detail: 'retry não é false.' });
  }
  if (e.backgroundEnabled !== false) {
    out.push({ flow: e.flow, code: 'background_attempted', detail: 'background não é false.' });
  }
  if (e.currentStage !== 'STAGE_0_READ_ONLY') {
    out.push({ flow: e.flow, code: 'unsafe_stability_escalation', detail: 'Stage diferente de STAGE_0_READ_ONLY.' });
  }
  if (!e.isolation.intact && e.classification === 'stable') {
    out.push({ flow: e.flow, code: 'isolation_boundary_leak', detail: 'Isolation rompido em envelope estável.' });
  }
  if (e.resolution.hiddenCount > 0 && e.classification === 'stable') {
    out.push({ flow: e.flow, code: 'hidden_dependency_expansion', detail: 'Dependência oculta em envelope estável.' });
  }
  return out;
}
