/**
 * Fase 1.7.9 — Idempotency contracts (READ-ONLY, pure).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import type { RpcIdempotencyContract } from './rpcContractTypes';

const REPLAY_KEYS: Record<FlowId, string[]> = {
  dashboard_profile_save: ['profile_id'],
  persist_first_service: ['provider_id', 'service_name'],
  bet_finish_pro: ['profile_id'],
  bet_finish_client: ['profile_id'],
  profile_type_switch: ['profile_id', 'new_type'],
  avatar_sync: ['profile_id', 'avatar_url'],
  onboarding_progress_sync: ['provider_id'],
  admin_profile_update: ['profile_id'],
  admin_provider_update: ['provider_id'],
};

export function detectNonIdempotentSideEffects(flow: FlowId): string[] {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return [];
  const risks: string[] = [];
  // persist_first_service can duplicate finalize if not deduped
  if (reg.requiresFinalize) risks.push('duplicate_finalize');
  // bootstrap can duplicate provider creation
  if (
    flow === 'bet_finish_pro' ||
    flow === 'persist_first_service' ||
    flow === 'profile_type_switch'
  ) {
    risks.push('duplicate_provider_bootstrap');
  }
  // service creation (without dedupe) can produce duplicates
  if (flow === 'persist_first_service') risks.push('duplicate_service_creation');
  // mirror sync can duplicate propagation events
  if (reg.sideEffects.some((s) => s.includes('mirror') || s.includes('photo'))) {
    risks.push('duplicate_mirror_propagation');
  }
  return risks;
}

export function buildIdempotencyContract(
  flow: FlowId,
): RpcIdempotencyContract | null {
  const keys = REPLAY_KEYS[flow];
  if (!keys) return null;
  const risks = detectNonIdempotentSideEffects(flow);
  return {
    flow,
    replayKeys: keys,
    deterministicReplay: risks.length === 0,
    requiresReplayProtection: risks.length > 0,
    nonIdempotentRisks: risks,
  };
}

export function supportsDeterministicReplay(flow: FlowId): boolean {
  return buildIdempotencyContract(flow)?.deterministicReplay ?? false;
}

export function requiresReplayProtection(flow: FlowId): boolean {
  return buildIdempotencyContract(flow)?.requiresReplayProtection ?? false;
}
