/**
 * Fase 1.8.0 — Pure explainers (READ-ONLY).
 */

import type {
  RuntimeTraceClassification,
  RuntimeTraceSeverity,
  RuntimeWriteTrace,
  TraceOrderingClass,
} from './recorderTypes';
import type { RuntimeParityGap } from './runtimeComparison';
import type { RuntimeTraceHealth } from './traceAggregation';

export function explainRuntimeTrace(t: RuntimeWriteTrace): string {
  return [
    `flow=${t.flow}`,
    `mode=${t.mode}`,
    `class=${t.classification}`,
    `consistency=${t.consistency}`,
    `severity=${t.severity}`,
    `ordering=${t.ordering.class}`,
    `steps=${t.steps.length}`,
  ].join(' · ');
}

export function explainRuntimeOrdering(t: RuntimeWriteTrace): string {
  if (t.ordering.violations.length === 0) {
    return `flow=${t.flow} ordering=expected`;
  }
  return [
    `flow=${t.flow}`,
    `ordering=${t.ordering.class}`,
    `violations=${t.ordering.violations.join(',')}`,
  ].join(' · ');
}

export function explainRuntimeClassification(c: RuntimeTraceClassification): string {
  switch (c) {
    case 'SAFE':
      return 'Trace consistente e dentro do plano esperado.';
    case 'PARTIAL':
      return 'Trace concluiu apenas parte dos passos esperados.';
    case 'DIVERGENT':
      return 'Trace divergiu do plano (passos críticos falharam).';
    case 'ORPHAN_RISK':
      return 'Trace gerou registros órfãos (mirror sem owner consolidado).';
    case 'MIRROR_DEPENDENT':
      return 'Trace executou mirror antes/independente do owner.';
    case 'NON_ATOMIC':
      return 'Fluxo não suporta atomicidade — observado em múltiplos passos sequenciais.';
    case 'EVENTUAL':
      return 'Consistência eventual — finalize ainda não confirmado.';
    case 'CRITICAL':
      return 'Falha crítica observada no trace.';
  }
}

export function explainRuntimeParityGap(gap: RuntimeParityGap): string {
  if (gap.reasons.length === 0) return `flow=${gap.flow} parity_gap=0`;
  return `flow=${gap.flow} parity_gap=${gap.gap} reasons=${gap.reasons.join(',')}`;
}

export function explainRuntimeHealth(h: RuntimeTraceHealth): string {
  return [
    `total=${h.total}`,
    `safe=${h.safe}`,
    `partial=${h.partial}`,
    `divergent=${h.divergent}`,
    `critical=${h.critical}`,
    `mirror=${h.mirrorDependent}`,
    `orphan=${h.orphanRisk}`,
    `worst_severity=${h.worstSeverity}`,
    `ordering_violation_rate=${h.orderingViolationRate}%`,
  ].join(' · ');
}

export function explainRuntimeSeverity(s: RuntimeTraceSeverity): string {
  return `severity=${s}`;
}

export function explainRuntimeOrderingClass(c: TraceOrderingClass): string {
  return `ordering_class=${c}`;
}
