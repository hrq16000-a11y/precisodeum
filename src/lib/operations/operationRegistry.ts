/**
 * Fase 1.7.0 — Central registry for atomic-ready operations.
 *
 * Declares, em um único lugar, o cruzamento "fluxo do app × builder 1.6.8 ×
 * boundary de persistência atual × readiness para atomicidade futura".
 *
 * Esta tabela é a fonte única que o readiness audit (`getAtomicReadiness`),
 * o auditor de writes (`detectUnsafeWrites`) e a futura migração para RPC
 * vão consumir. Mudanças aqui exigem atualizar os testes da 1.7.0.
 */

import type { ContactOwner } from '@/lib/contactOwnership';
import type { OperationStep } from './types';

export type Readiness = 'READY' | 'PARTIAL' | 'BLOCKED';

export type BoundaryId =
  | 'multiWriteSync'
  | 'avatarSync'
  | 'onboardingProgressSync'
  | 'adminWriteBoundary'
  | 'inline_call_site';

export type FlowId =
  | 'dashboard_profile_save'
  | 'persist_first_service'
  | 'bet_finish_client'
  | 'bet_finish_pro'
  | 'profile_type_switch'
  | 'avatar_sync'
  | 'onboarding_progress_sync'
  | 'admin_profile_update'
  | 'admin_provider_update';

export interface FlowRegistration {
  flow: FlowId;
  /** Builder 1.6.8 que representa este fluxo (null = não há builder dedicado). */
  builder:
    | 'buildDashboardProfileOperation'
    | 'buildPersistFirstServiceOperation'
    | 'buildBetFinalizeOperation'
    | 'buildProfileTypeSwitchOperation'
    | null;
  boundary: BoundaryId;
  ownership: ContactOwner | 'mixed';
  readiness: Readiness;
  dependencies: string[];
  sideEffects: string[];
  steps: OperationStep[];
  supportsAtomic: boolean;
  supportsRollback: boolean;
  requiresFinalize: boolean;
  requiresAvatarSync: boolean;
  requiresProgressSync: boolean;
}

export const OPERATION_REGISTRY: readonly FlowRegistration[] = [
  {
    flow: 'dashboard_profile_save',
    builder: 'buildDashboardProfileOperation',
    boundary: 'multiWriteSync',
    ownership: 'mixed', // depende de profileType resolvido pelo builder
    readiness: 'READY',
    dependencies: ['profiles.id', 'providers.user_id'],
    sideEffects: ['contact_ownership_conflict_audit'],
    steps: ['profile', 'provider'],
    supportsAtomic: true,
    supportsRollback: false,
    requiresFinalize: false,
    requiresAvatarSync: false,
    requiresProgressSync: false,
  },
  {
    flow: 'persist_first_service',
    builder: 'buildPersistFirstServiceOperation',
    boundary: 'onboardingProgressSync',
    ownership: 'provider',
    readiness: 'PARTIAL', // dependent de finalizeOnboarding externo
    dependencies: ['providers.id', 'categories.id', 'services.provider_id'],
    sideEffects: ['finalizeOnboarding', 'navigation_post_finalize'],
    steps: ['provider', 'service', 'finalize'],
    supportsAtomic: true,
    supportsRollback: false,
    requiresFinalize: true,
    requiresAvatarSync: false,
    requiresProgressSync: true,
  },
  {
    flow: 'bet_finish_client',
    builder: 'buildBetFinalizeOperation',
    boundary: 'multiWriteSync',
    ownership: 'profile',
    readiness: 'READY',
    dependencies: ['profiles.id'],
    sideEffects: ['next_redirect'],
    steps: ['profile', 'finalize'],
    supportsAtomic: true,
    supportsRollback: false,
    requiresFinalize: true,
    requiresAvatarSync: false,
    requiresProgressSync: false,
  },
  {
    flow: 'bet_finish_pro',
    builder: 'buildBetFinalizeOperation',
    boundary: 'multiWriteSync',
    ownership: 'provider',
    readiness: 'PARTIAL', // upsert provider + identity mirror
    dependencies: ['profiles.id', 'providers.user_id'],
    sideEffects: ['onboarding_progress_seed', 'next_redirect'],
    steps: ['profile', 'provider'],
    supportsAtomic: true,
    supportsRollback: false,
    requiresFinalize: false,
    requiresAvatarSync: false,
    requiresProgressSync: true,
  },
  {
    flow: 'profile_type_switch',
    builder: 'buildProfileTypeSwitchOperation',
    boundary: 'multiWriteSync',
    ownership: 'mixed',
    readiness: 'READY',
    dependencies: ['profiles.id', 'providers.user_id'],
    sideEffects: ['ownership_re_evaluation'],
    steps: ['profile_type', 'provider'],
    supportsAtomic: true,
    supportsRollback: false,
    requiresFinalize: false,
    requiresAvatarSync: false,
    requiresProgressSync: false,
  },
  {
    flow: 'avatar_sync',
    builder: null, // helper dedicado (setUserAvatar) — sem builder 1.6.8
    boundary: 'avatarSync',
    ownership: 'mixed',
    readiness: 'READY',
    dependencies: ['profiles.id'],
    sideEffects: ['providers_photo_mirror', 'social_avatar_oneshot'],
    steps: ['avatar'],
    supportsAtomic: true,
    supportsRollback: false,
    requiresFinalize: false,
    requiresAvatarSync: true,
    requiresProgressSync: false,
  },
  {
    flow: 'onboarding_progress_sync',
    builder: null,
    boundary: 'onboardingProgressSync',
    ownership: 'provider',
    readiness: 'READY',
    dependencies: ['providers.id'],
    sideEffects: [],
    steps: ['provider'],
    supportsAtomic: true,
    supportsRollback: false,
    requiresFinalize: false,
    requiresAvatarSync: false,
    requiresProgressSync: true,
  },
  {
    flow: 'admin_profile_update',
    builder: null,
    boundary: 'adminWriteBoundary',
    ownership: 'profile',
    readiness: 'READY',
    dependencies: ['profiles.id'],
    sideEffects: ['admin_audit_log'],
    steps: ['profile'],
    supportsAtomic: true,
    supportsRollback: false,
    requiresFinalize: false,
    requiresAvatarSync: false,
    requiresProgressSync: false,
  },
  {
    flow: 'admin_provider_update',
    builder: null,
    boundary: 'adminWriteBoundary',
    ownership: 'provider',
    readiness: 'READY',
    dependencies: ['providers.id'],
    sideEffects: ['admin_audit_log'],
    steps: ['provider'],
    supportsAtomic: true,
    supportsRollback: false,
    requiresFinalize: false,
    requiresAvatarSync: false,
    requiresProgressSync: false,
  },
] as const;

export function getFlowRegistration(flow: FlowId): FlowRegistration | undefined {
  return OPERATION_REGISTRY.find((r) => r.flow === flow);
}

export interface ReadinessSummary {
  ready: FlowId[];
  partial: FlowId[];
  blocked: FlowId[];
  total: number;
  coveragePct: number; // ready/total
}

export function getAtomicReadiness(): ReadinessSummary {
  const ready: FlowId[] = [];
  const partial: FlowId[] = [];
  const blocked: FlowId[] = [];
  for (const r of OPERATION_REGISTRY) {
    if (r.readiness === 'READY') ready.push(r.flow);
    else if (r.readiness === 'PARTIAL') partial.push(r.flow);
    else blocked.push(r.flow);
  }
  const total = OPERATION_REGISTRY.length;
  return {
    ready,
    partial,
    blocked,
    total,
    coveragePct: total === 0 ? 0 : Math.round((ready.length / total) * 100),
  };
}
