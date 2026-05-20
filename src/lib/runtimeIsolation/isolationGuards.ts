/**
 * Fase 1.8.6 — Isolation guards (READ-ONLY, never throws).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  IsolationCertification,
  IsolationEnvelope,
  IsolationViolation,
} from './isolationTypes';
import type {
  IsolationAuditAction,
  IsolationAuditPayload,
} from './isolationObservability';
import { isIsolationAuditPayloadPiiFree } from './isolationObservability';

export function assertIsolationCoverage(
  envelopes: readonly IsolationEnvelope[],
  expectedFlows: readonly FlowId[],
): IsolationViolation[] {
  const present = new Set(envelopes.map((e) => e.flow));
  const out: IsolationViolation[] = [];
  for (const f of expectedFlows) {
    if (!present.has(f)) {
      out.push({ flow: f, code: 'ISOLATION_COVERAGE_GAP', detail: `Sem envelope de isolamento para ${f}.` });
    }
  }
  return out;
}

export function assertNoIsolationLeakExpansion(
  prev: IsolationEnvelope,
  current: IsolationEnvelope,
): IsolationViolation[] {
  const out: IsolationViolation[] = [];
  if (current.leaks.length > prev.leaks.length) {
    out.push({
      flow: current.flow,
      code: 'ISOLATION_LEAK_EXPANSION',
      detail: `Leaks aumentaram de ${prev.leaks.length} para ${current.leaks.length}.`,
    });
  }
  return out;
}

export function assertIsolationContainment(e: IsolationEnvelope): IsolationViolation[] {
  const out: IsolationViolation[] = [];
  if (e.propagation.unbounded && e.classification !== 'COLLAPSED' && e.classification !== 'LEAKING') {
    out.push({ flow: e.flow, code: 'BOUNDARY_COLLAPSE', detail: 'Propagation unbounded fora de COLLAPSED/LEAKING.' });
  }
  return out;
}

export function assertIsolationDeterminism(
  a: IsolationEnvelope,
  b: IsolationEnvelope,
): IsolationViolation[] {
  const out: IsolationViolation[] = [];
  if (a.flow === b.flow && (a.classification !== b.classification || a.score !== b.score || a.severity !== b.severity)) {
    out.push({ flow: a.flow, code: 'NON_DETERMINISTIC_ISOLATION', detail: 'Envelopes divergem para mesmo input.' });
  }
  return out;
}

export function assertIsolationReadOnlyInvariant(e: IsolationEnvelope): IsolationViolation[] {
  const out: IsolationViolation[] = [];
  if (e.liveExecutionEnabled !== false) {
    out.push({ flow: e.flow, code: 'LIVE_EXECUTION_DETECTED', detail: 'liveExecution não é false.' });
  }
  if (e.realUsersAllowed !== false) {
    out.push({ flow: e.flow, code: 'REAL_USER_ENABLEMENT', detail: 'realUsersAllowed não é false.' });
  }
  if (e.retryEnabled !== false || e.backgroundEnabled !== false) {
    out.push({ flow: e.flow, code: 'BACKGROUND_ACTIVITY_DETECTED', detail: 'retry/background não é false.' });
  }
  if (e.currentStage !== 'STAGE_0_READ_ONLY') {
    out.push({ flow: e.flow, code: 'LIVE_EXECUTION_DETECTED', detail: 'Stage diferente de STAGE_0_READ_ONLY.' });
  }
  return out;
}

export function assertIsolationTopologyIntegrity(e: IsolationEnvelope): IsolationViolation[] {
  const out: IsolationViolation[] = [];
  if (e.topology.unsafeCoupling && (e.classification === 'FULLY_ISOLATED' || e.classification === 'CONTAINED')) {
    out.push({ flow: e.flow, code: 'UNSAFE_TOPOLOGY_OVERLAP', detail: 'Unsafe coupling em classificação segura.' });
  }
  if (e.topology.recursive && e.classification === 'FULLY_ISOLATED') {
    out.push({ flow: e.flow, code: 'UNSAFE_TOPOLOGY_OVERLAP', detail: 'Recursão em topologia totalmente isolada.' });
  }
  return out;
}

export function assertIsolationCertificationIntegrity(
  certs: readonly IsolationCertification[],
): IsolationViolation[] {
  const out: IsolationViolation[] = [];
  for (const c of certs) {
    if (c.certified && (c.classification === 'COLLAPSED' || c.classification === 'LEAKING')) {
      out.push({ flow: c.flow, code: 'CERTIFICATION_INTEGRITY_GAP', detail: 'Certificação com classificação insegura.' });
    }
    if (c.certified && c.severity === 'CRITICAL') {
      out.push({ flow: c.flow, code: 'CERTIFICATION_INTEGRITY_GAP', detail: 'Certificação com severity CRITICAL.' });
    }
  }
  return out;
}

export function assertIsolationObservabilityPurity(
  payloads: readonly IsolationAuditPayload[],
  allowed: readonly IsolationAuditAction[],
): IsolationViolation[] {
  const set = new Set<IsolationAuditAction>(allowed);
  const out: IsolationViolation[] = [];
  for (const p of payloads) {
    if (!set.has(p.action)) {
      out.push({ flow: p.flow, code: 'OBSERVABILITY_PII_LEAK', detail: `Ação não permitida: ${p.action}` });
    }
    if (!isIsolationAuditPayloadPiiFree(p)) {
      out.push({ flow: p.flow, code: 'OBSERVABILITY_PII_LEAK', detail: 'Payload contém PII.' });
    }
  }
  return out;
}
