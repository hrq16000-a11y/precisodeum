/**
 * Fase 1.7.9 — Side-effect policies (READ-ONLY, pure).
 *
 * Cada flow declara apenas side-effects PERMITIDOS. Tudo o que estiver
 * fora desta lista é classificado como forbidden.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import type {
  RpcSideEffectForbidden,
  RpcSideEffectKind,
  RpcSideEffectPolicy,
} from './rpcContractTypes';

const FORBIDDEN_ALWAYS: RpcSideEffectForbidden[] = [
  'hidden_retry',
  'silent_mutation',
  'recursive_finalize',
  'cross_flow_mutation',
  'implicit_ownership_reassignment',
];

const FLOW_ALLOWED: Record<FlowId, RpcSideEffectKind[]> = {
  dashboard_profile_save: ['audit_log', 'analytics'],
  persist_first_service: [
    'onboarding_progress',
    'analytics',
    'navigation',
    'toast',
    'draft_cleanup',
  ],
  bet_finish_pro: [
    'onboarding_progress',
    'analytics',
    'navigation',
    'toast',
  ],
  bet_finish_client: ['analytics', 'navigation', 'toast'],
  profile_type_switch: ['audit_log', 'mirror_sync', 'analytics'],
  avatar_sync: ['mirror_sync', 'avatar_propagation', 'analytics'],
  onboarding_progress_sync: ['onboarding_progress', 'analytics'],
  admin_profile_update: ['audit_log', 'analytics'],
  admin_provider_update: ['audit_log', 'analytics'],
};

export function buildSideEffectPolicy(flow: FlowId): RpcSideEffectPolicy | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  return {
    flow,
    allowed: FLOW_ALLOWED[flow] ?? [],
    forbidden: FORBIDDEN_ALWAYS,
  };
}

export function isSideEffectAllowed(
  flow: FlowId,
  effect: RpcSideEffectKind,
): boolean {
  const p = buildSideEffectPolicy(flow);
  return !!p && p.allowed.includes(effect);
}

export function listForbiddenSideEffects(): RpcSideEffectForbidden[] {
  return FORBIDDEN_ALWAYS.slice();
}
