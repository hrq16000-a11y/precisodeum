/**
 * buildShellModalProps — builders PUROS para snapshots dos modais externos
 * do OnboardingV2Shell (PR 14 — UI-only Shell Surface Reduction).
 *
 * Cobre as duas montagens repetitivas que viviam inline no shell:
 *   • `buildRemoteDraftSnapshot(remoteDraft)` — RemoteDraftRecoveryModal
 *   • `buildErrorContextSnapshot(state, lastPersistError)` — WizardErrorModal
 *
 * Estritamente sem side-effects: nenhum fetch, dispatch, refs ou storage.
 * Os callbacks (onContinue/onDiscard/onRetry/onBack) continuam sob ownership
 * do shell e são passados verbatim na composição final.
 */

interface RemoteDraftInput {
  payload?: unknown | null;
  phase?: string | null;
  updated_at?: string | null;
}

export interface RemoteDraftSnapshot {
  payload: unknown | null;
  phase: string | null;
  updatedAt: string | null;
}

export const buildRemoteDraftSnapshot = (remoteDraft: RemoteDraftInput | null | undefined): RemoteDraftSnapshot => ({
  payload: remoteDraft?.payload ?? null,
  phase: (remoteDraft?.phase as string | null) ?? null,
  updatedAt: remoteDraft?.updated_at ?? null,
});

interface ErrorContextStateInput {
  service?: { category_ids?: string[] | null } | null | undefined;
  profile?: { city?: string | null; state?: string | null } | null | undefined;
}

interface PersistErrorInput {
  message: string;
  code?: string | null;
}

export interface ErrorContextSnapshot {
  category: string | null;
  city: string | null;
  state_uf: string | null;
  lastPersistError: { message: string; code: string | null } | null;
}

export const buildErrorContextSnapshot = (
  state: ErrorContextStateInput,
  lastPersistError: PersistErrorInput | null | undefined,
): ErrorContextSnapshot => ({
  category: state.service?.category_ids?.[0] ?? null,
  city: state.profile?.city ?? null,
  state_uf: state.profile?.state ?? null,
  lastPersistError: lastPersistError
    ? { message: lastPersistError.message, code: lastPersistError.code ?? null }
    : null,
});

export default buildErrorContextSnapshot;
