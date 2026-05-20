/**
 * Fase 1.8.0 — Ordering analysis (READ-ONLY).
 */

import type { RuntimeWriteTrace } from './recorderTypes';

export function detectOutOfOrderExecution(t: RuntimeWriteTrace): boolean {
  return t.ordering.violations.includes('out_of_order');
}

export function detectUnsafeDependencyOrdering(t: RuntimeWriteTrace): boolean {
  return t.ordering.violations.includes('unsafe_dependency');
}

export function detectFinalizeBeforeMirror(t: RuntimeWriteTrace): boolean {
  return t.ordering.violations.includes('finalize_before_mirror');
}

export function detectMirrorBeforeOwner(t: RuntimeWriteTrace): boolean {
  return t.ordering.violations.includes('mirror_before_owner');
}

export function detectProgressBeforeFinalize(t: RuntimeWriteTrace): boolean {
  return t.ordering.violations.includes('progress_before_finalize');
}
