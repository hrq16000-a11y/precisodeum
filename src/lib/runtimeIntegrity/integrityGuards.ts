/**
 * Fase 1.8.5 — Integrity guards (READ-ONLY, never throws).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  RuntimeIntegrityEnvelope,
  RuntimeIntegrityViolation,
} from './integrityTypes';
import type {
  IntegrityAuditAction,
  IntegrityAuditPayload,
} from './integrityObservability';
import { isIntegrityAuditPayloadPiiFree } from './integrityObservability';

export function assertIntegrityCoverage(
  envelopes: readonly RuntimeIntegrityEnvelope[],
  expectedFlows: readonly FlowId[],
): RuntimeIntegrityViolation[] {
  const present = new Set(envelopes.map((e) => e.flow));
  const out: RuntimeIntegrityViolation[] = [];
  for (const f of expectedFlows) {
    if (!present.has(f)) {
      out.push({ flow: f, code: 'integrity_gap', detail: `Sem envelope de integridade para ${f}.` });
    }
  }
  return out;
}

export function assertContainmentIntegrity(
  e: RuntimeIntegrityEnvelope,
): RuntimeIntegrityViolation[] {
  const out: RuntimeIntegrityViolation[] = [];
  for (const c of e.containment) {
    if ((c.containment === 'unbounded' || c.containment === 'cascading') && e.classification === 'intact') {
      out.push({ flow: e.flow, code: 'containment_leak', detail: `Containment ${c.containment} em envelope intact.` });
    }
  }
  return out;
}

export function assertIsolationIntegrity(
  e: RuntimeIntegrityEnvelope,
): RuntimeIntegrityViolation[] {
  const out: RuntimeIntegrityViolation[] = [];
  if (e.isolation.isolation === 'globally_exposed' && e.classification !== 'collapsed') {
    out.push({ flow: e.flow, code: 'isolation_exposure', detail: 'Exposição global sem classificação collapsed.' });
  }
  if (!e.isolation.boundariesIntact && e.classification === 'intact') {
    out.push({ flow: e.flow, code: 'isolation_exposure', detail: 'Boundary rompido em envelope intact.' });
  }
  return out;
}

export function assertPropagationIntegrity(
  e: RuntimeIntegrityEnvelope,
): RuntimeIntegrityViolation[] {
  const out: RuntimeIntegrityViolation[] = [];
  for (const p of e.propagation) {
    if (p.recursive && e.classification === 'intact') {
      out.push({ flow: e.flow, code: 'recursive_integrity_propagation', detail: `Propagação recursiva em ${p.kind} dentro de envelope intact.` });
    }
    if (p.circular && e.classification !== 'collapsed' && e.classification !== 'compromised') {
      out.push({ flow: e.flow, code: 'circular_integrity_dependency', detail: `Propagação circular em ${p.kind}.` });
    }
  }
  return out;
}

export function assertTopologyIntegrity(
  e: RuntimeIntegrityEnvelope,
): RuntimeIntegrityViolation[] {
  const out: RuntimeIntegrityViolation[] = [];
  if (e.topology.leaking && e.classification === 'intact') {
    out.push({ flow: e.flow, code: 'cross_layer_integrity_failure', detail: 'Topologia leaking em envelope intact.' });
  }
  if (e.topology.gapCount > 0 && e.classification === 'intact') {
    out.push({ flow: e.flow, code: 'cross_layer_integrity_failure', detail: 'Gaps na topologia em envelope intact.' });
  }
  return out;
}

export function assertObservabilityPurity(
  payloads: readonly IntegrityAuditPayload[],
  allowedActions: readonly IntegrityAuditAction[],
): RuntimeIntegrityViolation[] {
  const allowed = new Set<IntegrityAuditAction>(allowedActions);
  const out: RuntimeIntegrityViolation[] = [];
  for (const p of payloads) {
    if (!allowed.has(p.action)) {
      out.push({ flow: p.flow, code: 'observability_pii_leak', detail: `Ação não permitida: ${p.action}` });
    }
    if (!isIntegrityAuditPayloadPiiFree(p)) {
      out.push({ flow: p.flow, code: 'observability_pii_leak', detail: 'Payload contém PII.' });
    }
  }
  return out;
}

export function assertNoUnsafeIntegrityPromotion(
  e: RuntimeIntegrityEnvelope,
): RuntimeIntegrityViolation[] {
  const out: RuntimeIntegrityViolation[] = [];
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
    out.push({ flow: e.flow, code: 'unsafe_integrity_escalation', detail: 'Stage diferente de STAGE_0_READ_ONLY.' });
  }
  return out;
}
