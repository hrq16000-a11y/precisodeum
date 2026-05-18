/**
 * Fase 1.7.6 — Rollback strategy registry (READ-ONLY).
 * Mapeia cada flow para a estratégia recomendada quando o write atômico
 * futuro falhar parcialmente. Apenas modelagem — não executa.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RollbackStrategyId } from './atomicBlueprintTypes';

export interface RollbackAssignment {
  flow: FlowId;
  strategy: RollbackStrategyId;
  rationale: string;
}

export const ROLLBACK_STRATEGIES: readonly RollbackAssignment[] = [
  {
    flow: 'dashboard_profile_save',
    strategy: 'compensating_write',
    rationale: 'profiles+providers exigem compensação em caso de mismatch parcial',
  },
  {
    flow: 'persist_first_service',
    strategy: 'safe_retry',
    rationale: 'idempotent upsert + finalize tolerante a retry',
  },
  {
    flow: 'bet_finish_client',
    strategy: 'safe_retry',
    rationale: 'single profile update — retry idempotente',
  },
  {
    flow: 'bet_finish_pro',
    strategy: 'compensating_write',
    rationale: 'profiles+providers+progress seed exigem compensação coordenada',
  },
  {
    flow: 'profile_type_switch',
    strategy: 'compensating_write',
    rationale: 'switch redireciona ownership — exige re-mirror determinístico',
  },
  {
    flow: 'avatar_sync',
    strategy: 'delayed_reconciliation',
    rationale: 'mirror não-crítico — reconciliation tolera atraso',
  },
  {
    flow: 'onboarding_progress_sync',
    strategy: 'safe_retry',
    rationale: 'progress columns são idempotentes',
  },
  {
    flow: 'admin_profile_update',
    strategy: 'hard_abort',
    rationale: 'admin context — falha deve ser visível imediatamente',
  },
  {
    flow: 'admin_provider_update',
    strategy: 'hard_abort',
    rationale: 'admin context — falha deve ser visível imediatamente',
  },
] as const;

export function getRollbackStrategy(flow: FlowId): RollbackAssignment | undefined {
  return ROLLBACK_STRATEGIES.find((r) => r.flow === flow);
}
