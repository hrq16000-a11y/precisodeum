/**
 * Fase 1.8.0 — Aggregate runtime recorder integrity (READ-ONLY).
 *
 * Executa todos os guards declarativos contra um conjunto opcional de
 * traces. Sem traces fornecidos, devolve [] (a camada é inerte por padrão).
 */

import type {
  RuntimeRecorderViolation,
  RuntimeWriteTrace,
} from './recorderTypes';
import {
  assertRuntimeTraceIntegrity,
  assertTraceClassificationConsistency,
  assertTraceOrderingConsistency,
  assertNoUnsafeRuntimeTrace,
  assertNoRuntimePromotionLeak,
} from './runtimeTraceGuards';

export function assertAllRuntimeRecorderIntegrity(
  traces: RuntimeWriteTrace[] = [],
): RuntimeRecorderViolation[] {
  const out: RuntimeRecorderViolation[] = [];
  out.push(...assertNoUnsafeRuntimeTrace(traces));
  for (const t of traces) {
    out.push(...assertRuntimeTraceIntegrity(t));
    out.push(...assertTraceOrderingConsistency(t));
    out.push(...assertTraceClassificationConsistency(t));
    out.push(...assertNoRuntimePromotionLeak(t));
  }
  return out;
}
