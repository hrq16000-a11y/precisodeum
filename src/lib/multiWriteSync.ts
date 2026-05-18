/**
 * Fase 1.6.3 — Sync tracker para writes multi-tabela.
 *
 * Padrão extraído de DashboardProfilePage.handleSave (Fase 1.4) e generalizado
 * para Bet/V2/Phase4/ProfileTypeSwitcher. Não cria transação real — apenas
 * observabilidade + impedir falso sucesso em falha parcial.
 *
 * Uso típico:
 *   const sync = createSyncTracker();
 *   sync.mark('profile', true);
 *   sync.mark('provider', false);
 *   if (sync.failedStep) {
 *     await logSyncFailure({ source: 'bet_finish_pro', ...sync.snapshot() });
 *     showPartialSaveError();
 *     return;
 *   }
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

export type SyncStep = 'profile' | 'provider' | 'service' | 'profile_type' | 'avatar' | 'status';

export const STANDARD_PARTIAL_MESSAGE =
  'Não foi possível salvar todas as informações. Tente novamente.';

export interface SyncSnapshot {
  profile_updated: boolean;
  provider_updated: boolean;
  service_created: boolean;
  failed_step: SyncStep | null;
}

export interface SyncTracker {
  mark: (step: SyncStep, ok: boolean) => void;
  setFailed: (step: SyncStep) => void;
  readonly failedStep: SyncStep | null;
  readonly profileUpdated: boolean;
  readonly providerUpdated: boolean;
  readonly serviceCreated: boolean;
  snapshot: () => SyncSnapshot;
}

export function createSyncTracker(): SyncTracker {
  const state = {
    profile_updated: false,
    provider_updated: false,
    service_created: false,
    failed_step: null as SyncStep | null,
  };
  return {
    mark(step, ok) {
      if (step === 'profile' || step === 'profile_type' || step === 'avatar') {
        if (ok) state.profile_updated = true;
        else if (!state.failed_step) state.failed_step = step;
      } else if (step === 'provider' || step === 'status') {
        if (ok) state.provider_updated = true;
        else if (!state.failed_step) state.failed_step = step;
      } else if (step === 'service') {
        if (ok) state.service_created = true;
        else if (!state.failed_step) state.failed_step = step;
      }
    },
    setFailed(step) {
      if (!state.failed_step) state.failed_step = step;
    },
    get failedStep() { return state.failed_step; },
    get profileUpdated() { return state.profile_updated; },
    get providerUpdated() { return state.provider_updated; },
    get serviceCreated() { return state.service_created; },
    snapshot() {
      return {
        profile_updated: state.profile_updated,
        provider_updated: state.provider_updated,
        service_created: state.service_created,
        failed_step: state.failed_step,
      };
    },
  };
}

type SyncFailureAction =
  | 'bet_onboarding_sync_failed'
  | 'profile_type_switch_sync_failed'
  | 'persist_first_service_sync_failed'
  | 'phase4_sync_failed';

export interface LogSyncFailureOpts {
  action: SyncFailureAction;
  source: string; // call-site identifier (sem PII)
  snapshot: SyncSnapshot;
  errorCode?: string | null;
  extra?: Record<string, unknown>;
}

/**
 * Emite audit_log SEM PII para falhas parciais multi-tabela.
 * Fail-soft: nunca lança.
 */
export async function logSyncFailure(opts: LogSyncFailureOpts): Promise<void> {
  try {
    await logAuditAction({
      action: opts.action,
      resource_type: 'multi_write_sync',
      details: {
        source: opts.source,
        ...opts.snapshot,
        error_code: opts.errorCode ?? null,
        ...(opts.extra || {}),
      },
    });
  } catch {
    /* fail-soft */
  }
}

/** Toast amigável padronizado para falha parcial — sem stack/SQL. */
export function showPartialSyncError(retryFn?: () => void): void {
  toast.error(STANDARD_PARTIAL_MESSAGE, {
    duration: 8000,
    action: retryFn ? { label: 'Tentar novamente', onClick: retryFn } : undefined,
  });
}
