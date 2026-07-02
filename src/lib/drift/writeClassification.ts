/**
 * Fase 1.7.3 — Write path classification (READ-ONLY).
 *
 * Classificação estrutural formal de write paths, boundaries e operations.
 * 100% pura, sem Supabase / hooks / side-effects.
 *
 * Categorias:
 *  - SAFE     → boundary canônica + tracker + ownership + readiness READY
 *  - GUARDED  → boundary canônica + tracker, mas readiness PARTIAL ou multi-write
 *               não-atômico ainda em shadow mode (aceitável, monitorado)
 *  - LEGACY   → fluxo legado tolerado (allow-list explícita) com risco conhecido
 *  - UNSAFE   → bypass direto, sem boundary, sem tracker, drift potencial alto
 *  - UNKNOWN  → não foi possível classificar (registry incompleto)
 */

import {
  OPERATION_REGISTRY,
  type BoundaryId,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';

export type WriteClassification = 'SAFE' | 'GUARDED' | 'LEGACY' | 'UNSAFE' | 'UNKNOWN';

export type WriteOperationKind = 'update' | 'insert' | 'upsert' | 'delete' | 'unknown';

export interface WriteClassificationResult {
  classification: WriteClassification;
  reason: string;
}

/**
 * Boundaries oficialmente reconhecidas (1.6.3 → 1.6.7).
 * `inline_call_site` é a única boundary "não-canônica" (legacy).
 */
const CANONICAL_BOUNDARIES: ReadonlySet<BoundaryId> = new Set<BoundaryId>([
  'multiWriteSync',
  'avatarSync',
  'onboardingProgressSync',
  'adminWriteBoundary',
]);

/** Boundaries que possuem tracker de partial-failure. */
const BOUNDARIES_WITH_TRACKER: ReadonlySet<BoundaryId> = new Set<BoundaryId>([
  'multiWriteSync',
  'avatarSync',
  'onboardingProgressSync',
  'adminWriteBoundary',
]);

export function isCanonicalBoundary(boundary: BoundaryId): boolean {
  return CANONICAL_BOUNDARIES.has(boundary);
}

export function boundaryHasTracker(boundary: BoundaryId): boolean {
  return BOUNDARIES_WITH_TRACKER.has(boundary);
}

/** Classifica uma boundary isoladamente. */
export function classifyBoundary(boundary: BoundaryId): WriteClassificationResult {
  if (!CANONICAL_BOUNDARIES.has(boundary)) {
    return { classification: 'LEGACY', reason: 'boundary_inline_call_site' };
  }
  if (!BOUNDARIES_WITH_TRACKER.has(boundary)) {
    return { classification: 'GUARDED', reason: 'canonical_boundary_without_tracker' };
  }
  return { classification: 'SAFE', reason: 'canonical_boundary_with_tracker' };
}

/** Classifica uma operação genérica (sem flow conhecido). */
export function classifyOperation(operation: WriteOperationKind): WriteClassificationResult {
  if (operation === 'unknown') {
    return { classification: 'UNKNOWN', reason: 'operation_kind_unknown' };
  }
  if (operation === 'delete') {
    // Destructive — sempre exige boundary; sozinho não pode ser SAFE.
    return { classification: 'GUARDED', reason: 'destructive_operation_requires_boundary' };
  }
  return { classification: 'GUARDED', reason: 'operation_requires_flow_context' };
}

/** Classifica um flow registrado no `operationRegistry`. */
export function classifyWritePath(flow: FlowId): WriteClassificationResult {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return { classification: 'UNKNOWN', reason: 'flow_not_in_registry' };
  return classifyFlowRegistration(reg);
}

export function classifyFlowRegistration(reg: FlowRegistration): WriteClassificationResult {
  const boundaryResult = classifyBoundary(reg.boundary);
  if (boundaryResult.classification === 'LEGACY') {
    return { classification: 'LEGACY', reason: 'flow_uses_legacy_boundary' };
  }
  if (boundaryResult.classification === 'UNKNOWN') {
    return { classification: 'UNKNOWN', reason: 'flow_boundary_unknown' };
  }

  const hasTracker = BOUNDARIES_WITH_TRACKER.has(reg.boundary);
  const hasOwnership = reg.ownership === 'profile' || reg.ownership === 'provider' || reg.ownership === 'mixed';
  const isMultiWrite = reg.steps.length > 1;

  if (!hasOwnership) {
    return { classification: 'UNSAFE', reason: 'flow_missing_ownership' };
  }
  if (!hasTracker) {
    return { classification: 'UNSAFE', reason: 'flow_boundary_without_tracker' };
  }
  if (reg.readiness === 'BLOCKED') {
    return { classification: 'UNSAFE', reason: 'flow_readiness_blocked' };
  }
  if (reg.readiness === 'PARTIAL') {
    return { classification: 'GUARDED', reason: 'flow_readiness_partial' };
  }
  // READY
  if (isMultiWrite && !reg.supportsAtomic) {
    return { classification: 'GUARDED', reason: 'multi_write_without_atomic_support' };
  }
  return { classification: 'SAFE', reason: 'flow_ready_with_canonical_boundary_and_tracker' };
}

/** Explainer determinístico — string pura. */
export function explainWriteClassification(
  flow: FlowId,
  result: WriteClassificationResult,
): string {
  return `flow=${flow} classification=${result.classification} reason=${result.reason}`;
}
