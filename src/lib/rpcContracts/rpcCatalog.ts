/**
 * Fase 1.7.9 — Catálogo de contratos das futuras RPCs (READ-ONLY).
 *
 * Cada entrada declara apenas o CONTRATO formal. Nenhuma RPC é criada.
 * O catálogo é a fonte única para readiness, compatibility e asserts.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export interface RpcCatalogEntry {
  rpc: string;
  flow: FlowId;
  description: string;
  requiredBuilders: string[];
  requiredTrackers: string[];
  ownership: 'profile' | 'provider' | 'admin' | 'mixed';
}

export const RPC_CATALOG: readonly RpcCatalogEntry[] = [
  {
    rpc: 'save_dashboard_profile_atomic',
    flow: 'dashboard_profile_save',
    description:
      'Persist profile + provider mirror in a single transactional unit.',
    requiredBuilders: ['buildDashboardProfileOperation'],
    requiredTrackers: ['contact_ownership_conflict_audit'],
    ownership: 'mixed',
  },
  {
    rpc: 'persist_first_service_atomic',
    flow: 'persist_first_service',
    description:
      'Ensure provider exists, persist first service, finalize onboarding.',
    requiredBuilders: ['buildPersistFirstServiceOperation'],
    requiredTrackers: ['finalizeOnboarding'],
    ownership: 'provider',
  },
  {
    rpc: 'complete_bet_onboarding_atomic',
    flow: 'bet_finish_pro',
    description: 'Bet mode finalize: profile + provider + progress seed.',
    requiredBuilders: ['buildBetFinalizeOperation'],
    requiredTrackers: ['onboarding_progress_seed'],
    ownership: 'provider',
  },
  {
    rpc: 'complete_bet_onboarding_client_atomic',
    flow: 'bet_finish_client',
    description: 'Bet mode finalize for client profiles (single profile write).',
    requiredBuilders: ['buildBetFinalizeOperation'],
    requiredTrackers: [],
    ownership: 'profile',
  },
  {
    rpc: 'switch_profile_type_atomic',
    flow: 'profile_type_switch',
    description: 'Switch profile type and re-mirror provider ownership.',
    requiredBuilders: ['buildProfileTypeSwitchOperation'],
    requiredTrackers: ['ownership_re_evaluation'],
    ownership: 'mixed',
  },
  {
    rpc: 'admin_update_user_atomic_profile',
    flow: 'admin_profile_update',
    description: 'Admin-scoped profile update with audit boundary.',
    requiredBuilders: [],
    requiredTrackers: ['admin_audit_log'],
    ownership: 'admin',
  },
  {
    rpc: 'admin_update_user_atomic_provider',
    flow: 'admin_provider_update',
    description: 'Admin-scoped provider update with audit boundary.',
    requiredBuilders: [],
    requiredTrackers: ['admin_audit_log'],
    ownership: 'admin',
  },
  {
    rpc: 'set_avatar_atomic',
    flow: 'avatar_sync',
    description: 'Set avatar and propagate provider photo mirror.',
    requiredBuilders: [],
    requiredTrackers: ['providers_photo_mirror'],
    ownership: 'mixed',
  },
  {
    rpc: 'set_onboarding_progress_atomic',
    flow: 'onboarding_progress_sync',
    description: 'Update onboarding progress columns idempotently.',
    requiredBuilders: [],
    requiredTrackers: [],
    ownership: 'provider',
  },
] as const;

export function getCatalogEntryByFlow(flow: FlowId): RpcCatalogEntry | undefined {
  return RPC_CATALOG.find((r) => r.flow === flow);
}

export function getCatalogEntryByRpc(rpc: string): RpcCatalogEntry | undefined {
  return RPC_CATALOG.find((r) => r.rpc === rpc);
}
