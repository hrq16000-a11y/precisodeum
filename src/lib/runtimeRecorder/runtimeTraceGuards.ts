/**
 * Fase 1.8.0 — Runtime trace guards (READ-ONLY).
 */

import type {
  RuntimeRecorderViolation,
  RuntimeWriteTrace,
} from './recorderTypes';
import {
  isUnsafeClassification,
  classificationSeverityFloor,
} from './traceClassification';

const SEV_ORDER = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type Sev = (typeof SEV_ORDER)[number];
const sevRank = (s: Sev) => SEV_ORDER.indexOf(s);

export function assertRuntimeTraceIntegrity(
  trace: RuntimeWriteTrace,
): RuntimeRecorderViolation[] {
  const out: RuntimeRecorderViolation[] = [];
  if ((trace as any).liveExecution !== false) {
    out.push({
      code: 'live_execution_attempted',
      flow: trace.flow,
      detail: 'trace.liveExecution !== false',
    });
  }
  if ((trace as any).retry !== false) {
    out.push({ code: 'retry_attempted', flow: trace.flow, detail: 'trace.retry !== false' });
  }
  if ((trace as any).background !== false) {
    out.push({
      code: 'background_attempted',
      flow: trace.flow,
      detail: 'trace.background !== false',
    });
  }
  if ((trace as any).persisted !== false) {
    out.push({
      code: 'persistence_attempted',
      flow: trace.flow,
      detail: 'trace.persisted !== false',
    });
  }
  if ((trace as any).realUserMutation !== false) {
    out.push({
      code: 'real_user_mutation',
      flow: trace.flow,
      detail: 'trace.realUserMutation !== false',
    });
  }
  if (trace.mode !== 'shadow' && trace.mode !== 'observe_only' && trace.mode !== 'simulated' && trace.mode !== 'inert') {
    out.push({
      code: 'mode_violation',
      flow: trace.flow,
      detail: `unexpected mode=${trace.mode}`,
    });
  }
  return out;
}

export function assertNoUnsafeRuntimeTrace(
  traces: RuntimeWriteTrace[],
): RuntimeRecorderViolation[] {
  const out: RuntimeRecorderViolation[] = [];
  for (const t of traces) {
    if ((t as any).liveExecution || (t as any).persisted || (t as any).realUserMutation) {
      out.push({
        code: 'live_execution_attempted',
        flow: t.flow,
        detail: 'unsafe runtime trace detected',
      });
    }
  }
  return out;
}

export function assertTraceOrderingConsistency(
  trace: RuntimeWriteTrace,
): RuntimeRecorderViolation[] {
  const out: RuntimeRecorderViolation[] = [];
  if (trace.ordering.actualOrder.length !== trace.steps.length) {
    out.push({
      code: 'ordering_inconsistency',
      flow: trace.flow,
      detail: 'actualOrder length mismatches steps',
    });
  }
  return out;
}

export function assertTraceClassificationConsistency(
  trace: RuntimeWriteTrace,
): RuntimeRecorderViolation[] {
  const out: RuntimeRecorderViolation[] = [];
  const floor = classificationSeverityFloor(trace.classification);
  if (sevRank(trace.severity) < sevRank(floor)) {
    out.push({
      code: 'classification_inconsistency',
      flow: trace.flow,
      detail: `severity ${trace.severity} below floor ${floor} for ${trace.classification}`,
    });
  }
  return out;
}

export function assertNoRuntimePromotionLeak(
  trace: RuntimeWriteTrace,
): RuntimeRecorderViolation[] {
  // Trace nunca pode sugerir promoção real: classificação UNSAFE + persistence
  // ou live execution = leak. Persistência/live já são travados acima; aqui
  // garantimos que mode != live e que nenhuma flag não-declarada foi setada.
  const out: RuntimeRecorderViolation[] = [];
  if ((trace as any).promotion === 'STAGE_1' || (trace as any).promotion === 'STAGE_2') {
    out.push({
      code: 'promotion_leak_detected',
      flow: trace.flow,
      detail: 'trace carries promotion stage hint',
    });
  }
  if (isUnsafeClassification(trace.classification) && trace.mode !== 'observe_only' && trace.mode !== 'shadow') {
    out.push({
      code: 'promotion_leak_detected',
      flow: trace.flow,
      detail: `unsafe classification ${trace.classification} in mode ${trace.mode}`,
    });
  }
  return out;
}
