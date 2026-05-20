/**
 * Fase 1.8.7 — Runtime lockdown (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  EnforcementBoundary,
  EnforcementLayer,
  EnforcementViolation,
  LockdownClassification,
} from './enforcementTypes';

export interface LockdownSignal {
  readonly flow: FlowId;
  readonly boundaries: readonly EnforcementBoundary[];
  readonly recursive?: boolean;
  readonly promotionOverride?: boolean;
  readonly unsafeActivation?: boolean;
}

export function buildRuntimeLockdown(s: LockdownSignal): LockdownClassification {
  if (s.boundaries.length === 0) return 'restricted';
  const anyBlocked = s.boundaries.some(b => b.classification === 'BLOCKED');
  const anyRestricted = s.boundaries.some(b => b.classification === 'RESTRICTED');
  if (anyBlocked || s.unsafeActivation) return 'collapsed';
  if (s.recursive) return 'unsafe';
  if (s.promotionOverride) return 'unsafe';
  if (anyRestricted) return 'restricted';
  const allLocked = s.boundaries.every(b => b.locked);
  if (allLocked) return 'fully_locked';
  return 'guarded';
}

export function detectRuntimeUnlock(s: LockdownSignal): EnforcementViolation | null {
  const unlocked = s.boundaries.find(b => !b.locked && b.classification === 'BLOCKED');
  if (!unlocked) return null;
  return {
    flow: s.flow, layer: unlocked.layer, type: 'runtime_activation',
    severity: 'CRITICAL', detail: 'runtime_unlock_detected',
  };
}

export function detectUnsafeRuntimeActivation(s: LockdownSignal): EnforcementViolation | null {
  if (!s.unsafeActivation) return null;
  const layer: EnforcementLayer = s.boundaries[0]?.layer ?? 'isolation';
  return {
    flow: s.flow, layer, type: 'runtime_activation',
    severity: 'CRITICAL', detail: 'unsafe_runtime_activation',
  };
}

export function detectPromotionOverride(s: LockdownSignal): EnforcementViolation | null {
  if (!s.promotionOverride) return null;
  const layer: EnforcementLayer = s.boundaries.find(b => b.layer === 'promotion')?.layer ?? 'promotion';
  return {
    flow: s.flow, layer, type: 'promotion_override',
    severity: 'HIGH', detail: 'promotion_override_detected',
  };
}

export function detectRecursiveRuntimeDependency(s: LockdownSignal): EnforcementViolation | null {
  if (!s.recursive) return null;
  const layer: EnforcementLayer = s.boundaries[0]?.layer ?? 'isolation';
  return {
    flow: s.flow, layer, type: 'recursive_runtime',
    severity: 'HIGH', detail: 'recursive_runtime_dependency',
  };
}
