/**
 * Fase 1.6.9 — Shadow Atomic Execution Layer (PRE-RPC).
 *
 * Consolida em uma única boundary client-side a execução dos writes
 * multi-step descritos pelos builders da Fase 1.6.8 — SEM substituir a
 * persistência atual e SEM criar transação real.
 *
 * Modo padrão: `dry-run` (shadow). NÃO toca em supabase. Apenas:
 *   - normaliza o plano de execução (shape canônico)
 *   - valida dependências declaradas
 *   - compara com snapshot real fornecido pelo call-site
 *   - emite observabilidade (mismatch / failed) sem PII
 *
 * Modo `live` existe somente para uso futuro pela RPC consolidada; hoje
 * permanece atrás de `enableLiveExecution=false` para nunca alterar
 * comportamento de produção.
 *
 * Re-uso obrigatório:
 *   - createSyncTracker / logSyncFailure / STANDARD_PARTIAL_MESSAGE (1.6.3)
 *   - setUserAvatar (1.6.4)
 *   - setOnboardingProgress (1.6.5)
 *   - resolveContactOwner (1.6.6)
 *   - adminWriteBoundary (1.6.7) — NÃO invocado aqui; permanece com o admin.
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import {
  createSyncTracker,
  STANDARD_PARTIAL_MESSAGE,
  type SyncTracker,
} from '@/lib/multiWriteSync';
import type {
  OperationStep,
  PreAtomicOperation,
} from './types';

/** Shape canônico da Fase 1.6.9 — todos os builders 1.6.8 convergem aqui. */
export interface ExecutionPlan {
  source: string;
  ownership: PreAtomicOperation['ownership'];
  steps: OperationStep[];
  dependencies: string[];
  executionPlan: OperationStep[];
  requiresFinalize: boolean;
  requiresAvatarSync: boolean;
  requiresProgressSync: boolean;
  requiresServiceWrite: boolean;
}

/** Deriva o plano canônico a partir de qualquer operação 1.6.8. */
export function toExecutionPlan(op: PreAtomicOperation): ExecutionPlan {
  return {
    source: op.source,
    ownership: op.ownership,
    steps: [...op.steps],
    dependencies: [...op.dependencies],
    executionPlan: [...op.steps],
    requiresFinalize: !!op.requiresFinalize,
    requiresAvatarSync: !!op.requiresAvatarSync,
    requiresProgressSync: op.steps.includes('provider'),
    requiresServiceWrite: op.steps.includes('service') || op.servicePayload != null,
  };
}

export type ExecutionMode = 'dry-run' | 'live';

export interface ExecutionContextSnapshot {
  /** Resultado real observado pelo call-site após sua persistência atual. */
  profileUpdated?: boolean;
  providerUpdated?: boolean;
  serviceCreated?: boolean;
  finalizeRan?: boolean;
  avatarSynced?: boolean;
  progressSynced?: boolean;
  failedStep?: OperationStep | null;
  /** Provider id conhecido (sem PII). */
  hasProviderId?: boolean;
  /** Categoria conhecida (sem PII). */
  hasCategoryId?: boolean;
}

export interface ExecuteOperationOptions {
  mode?: ExecutionMode; // default: 'dry-run'
  tracker?: SyncTracker;
  /** Snapshot fornecido pelo call-site para detectar mismatch shadow vs real. */
  observed?: ExecutionContextSnapshot;
  /** Permite habilitar 'live' explicitamente (default: false). */
  enableLiveExecution?: boolean;
}

export interface ExecuteOperationResult {
  ok: boolean;
  mode: ExecutionMode;
  plan: ExecutionPlan;
  mismatches: string[];
  missingDependencies: string[];
  message?: string;
}

function detectMissingDependencies(
  plan: ExecutionPlan,
  observed: ExecutionContextSnapshot,
): string[] {
  const missing: string[] = [];
  if (plan.dependencies.includes('providers.id') && observed.hasProviderId === false) {
    missing.push('providers.id');
  }
  if (plan.dependencies.includes('categories.id') && observed.hasCategoryId === false) {
    missing.push('categories.id');
  }
  return missing;
}

function detectMismatches(
  plan: ExecutionPlan,
  observed: ExecutionContextSnapshot,
): string[] {
  const out: string[] = [];
  for (const step of plan.steps) {
    switch (step) {
      case 'profile':
      case 'profile_type':
        if (observed.profileUpdated === false) out.push(step);
        break;
      case 'provider':
        if (observed.providerUpdated === false) out.push(step);
        break;
      case 'service':
        if (observed.serviceCreated === false) out.push(step);
        break;
      case 'finalize':
        if (plan.requiresFinalize && observed.finalizeRan === false) out.push(step);
        break;
      case 'avatar':
        if (plan.requiresAvatarSync && observed.avatarSynced === false) out.push(step);
        break;
    }
  }
  return out;
}

async function logExecutionMismatch(
  plan: ExecutionPlan,
  mismatches: string[],
  missingDeps: string[],
  observed: ExecutionContextSnapshot,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'operation_execution_mismatch' as any,
      resource_type: 'pre_atomic_operation',
      details: {
        source: plan.source,
        ownership: plan.ownership,
        execution_path: plan.executionPlan,
        mismatched_steps: mismatches,
        missing_dependency: missingDeps[0] ?? null,
        requires_finalize: plan.requiresFinalize,
        requires_avatar_sync: plan.requiresAvatarSync,
        requires_progress_sync: plan.requiresProgressSync,
        requires_service_write: plan.requiresServiceWrite,
        observed_failed_step: observed.failedStep ?? null,
      },
    });
  } catch {
    /* fail-soft */
  }
}

async function logExecutionFailed(
  plan: ExecutionPlan,
  failedStep: OperationStep | null,
  errorCode?: string | null,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'operation_execution_failed' as any,
      resource_type: 'pre_atomic_operation',
      details: {
        source: plan.source,
        ownership: plan.ownership,
        failed_step: failedStep,
        execution_path: plan.executionPlan,
        error_code: errorCode ?? null,
      },
    });
  } catch {
    /* fail-soft */
  }
}

/**
 * Boundary única de execução shadow. NÃO altera o fluxo atual:
 * call-sites continuam persistindo via seus boundaries (1.6.3/1.6.4/1.6.5/1.6.7).
 * Aqui apenas validamos plano + observamos resultado real + emitimos audit.
 */
export async function executeOperation(
  op: PreAtomicOperation,
  options: ExecuteOperationOptions = {},
): Promise<ExecuteOperationResult> {
  const mode: ExecutionMode =
    options.mode === 'live' && options.enableLiveExecution === true ? 'live' : 'dry-run';
  const plan = toExecutionPlan(op);
  const observed = options.observed ?? {};
  const missingDeps = detectMissingDependencies(plan, observed);
  const mismatches = detectMismatches(plan, observed);

  // Em dry-run NUNCA executamos writes reais; apenas observabilidade.
  if (mode === 'dry-run') {
    if (mismatches.length > 0 || missingDeps.length > 0) {
      await logExecutionMismatch(plan, mismatches, missingDeps, observed);
    }
    if (observed.failedStep) {
      await logExecutionFailed(plan, observed.failedStep, null);
    }
    return {
      ok: mismatches.length === 0 && missingDeps.length === 0 && !observed.failedStep,
      mode,
      plan,
      mismatches,
      missingDependencies: missingDeps,
      message: observed.failedStep ? STANDARD_PARTIAL_MESSAGE : undefined,
    };
  }

  // 'live' permanece um stub explícito para evitar uso acidental até a RPC.
  await logExecutionFailed(plan, null, 'live_mode_not_implemented');
  return {
    ok: false,
    mode,
    plan,
    mismatches,
    missingDependencies: missingDeps,
    message: STANDARD_PARTIAL_MESSAGE,
  };
}

/** Conveniência: cria tracker se não existir — preserva integração 1.6.3. */
export function ensureTracker(tracker?: SyncTracker): SyncTracker {
  return tracker ?? createSyncTracker();
}

// Sub-boundaries são intencionalmente NO-OP nesta fase: a persistência real
// permanece nos call-sites. Exportadas como funções nomeadas apenas para
// formalizar o contrato e simplificar a migração futura para RPC.
export async function executeProfileWrite(): Promise<void> { /* shadow no-op */ }
export async function executeProviderWrite(): Promise<void> { /* shadow no-op */ }
export async function executeServiceWrite(): Promise<void> { /* shadow no-op */ }
export async function executeFinalize(): Promise<void> { /* shadow no-op */ }
export async function executeAvatarSync(): Promise<void> { /* shadow no-op */ }
export async function executeProgressSync(): Promise<void> { /* shadow no-op */ }
