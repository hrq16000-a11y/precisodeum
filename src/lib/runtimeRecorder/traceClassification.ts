/**
 * Fase 1.8.0 — Trace classification helpers (READ-ONLY).
 *
 * Reexpõe classes canônicas e helpers para teste/observabilidade.
 */

import type {
  RuntimeTraceClassification,
  RuntimeTraceSeverity,
  RuntimeWriteTrace,
} from './recorderTypes';

export const TRACE_CLASSES: readonly RuntimeTraceClassification[] = [
  'SAFE',
  'PARTIAL',
  'DIVERGENT',
  'ORPHAN_RISK',
  'MIRROR_DEPENDENT',
  'NON_ATOMIC',
  'EVENTUAL',
  'CRITICAL',
] as const;

export const UNSAFE_TRACE_CLASSES: readonly RuntimeTraceClassification[] = [
  'DIVERGENT',
  'ORPHAN_RISK',
  'MIRROR_DEPENDENT',
  'CRITICAL',
] as const;

export function isUnsafeClassification(c: RuntimeTraceClassification): boolean {
  return UNSAFE_TRACE_CLASSES.includes(c);
}

export function classificationSeverityFloor(
  c: RuntimeTraceClassification,
): RuntimeTraceSeverity {
  switch (c) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'ORPHAN_RISK':
    case 'MIRROR_DEPENDENT':
      return 'HIGH';
    case 'DIVERGENT':
      return 'MEDIUM';
    case 'PARTIAL':
      return 'LOW';
    case 'EVENTUAL':
      // Fase 1.8.0 fix: EVENTUAL é estado esperado por design (sem finalize obrigatório
      // executado), pode permanecer NONE quando parity ok, sem orphan, sem ordering issue.
      return 'NONE';
    case 'NON_ATOMIC':
      return 'LOW';
    default:
      return 'NONE';
  }
}

export function classifyTraceShort(t: RuntimeWriteTrace): RuntimeTraceClassification {
  return t.classification;
}
