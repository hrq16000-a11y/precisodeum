/**
 * Phase2PhotosBlockedCard — UI pura para o estado bloqueado da fase
 * `phase2_photos` (firstServiceId ausente ou sessão expirada).
 *
 * Extraído do OnboardingV2Shell (PR 9 — UI Composition Pass). Não toca
 * reducer, persistência, hydration, telemetria nem runtime: apenas renderiza
 * o card de diagnóstico. Toda lógica de recuperação (`handleRecoverDraft`,
 * auto-retry, logging one-shot) permanece no shell e é injetada via callbacks.
 *
 * Contrato estável (qualquer mudança aqui é puramente visual):
 *  - `reason` controla cabeçalho/descrição/CTAs primários
 *  - `phase2RetryStatus` controla o badge "tentando recuperar" / fallback erro
 *  - todos os handlers (`onRetryManual`, `onBackToDetails`, `onSkip`, `onLogin`)
 *    são fornecidos pelo shell para preservar telemetria + dispatch existentes.
 */
import ReportWizardErrorButton from '@/components/wizard/ReportWizardErrorButton';

export type Phase2PhotosBlockReason = 'no_service' | 'no_session';
export type Phase2RetryStatus = 'idle' | 'running' | 'failed';

interface ContextSnapshot {
  primaryCategoryId: string | null;
  city: string | null;
  stateUF: string | null;
  providerId: string | null;
  firstServiceId: string | null;
  lastPersistError: { message: string; code?: string | null } | null;
}

interface Phase2PhotosBlockedCardProps {
  reason: Phase2PhotosBlockReason;
  missing: string[];
  phase2RetryStatus: Phase2RetryStatus;
  context: ContextSnapshot;
  onRetryManual: () => void;
  onBackToDetails: () => void;
  onSkip: () => void;
  onLogin: () => void;
}

export const Phase2PhotosBlockedCard = ({
  reason,
  missing,
  phase2RetryStatus,
  context,
  onRetryManual,
  onBackToDetails,
  onSkip,
  onLogin,
}: Phase2PhotosBlockedCardProps) => {
  const title = reason === 'no_session'
    ? 'Sua sessão expirou'
    : 'Ainda não consegui carregar seu serviço';

  const description = reason === 'no_session'
    ? 'Faça login novamente para continuar de onde parou. Seu cadastro foi salvo.'
    : missing.length > 0
      ? 'Faltam estes campos para publicar o serviço antes das fotos:'
      : 'Para subir as fotos, primeiro preciso terminar de salvar seu serviço (categoria, descrição e cidade). Volte uma etapa, confirme os dados e tente novamente.';

  return (
    <section
      className="mx-auto w-full max-w-md space-y-3 px-4 py-5 text-center"
      role="alert"
      aria-live="polite"
      data-testid="phase2-photos-blocked"
    >
      <div className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
        <h2 className="font-display text-base font-extrabold text-amber-900 dark:text-amber-100">
          {title}
        </h2>
        <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
          {description}
        </p>
        {reason === 'no_service' && missing.length > 0 && (
          <ul
            data-testid="phase2-photos-missing-fields"
            className="mx-auto mt-2 max-w-xs space-y-0.5 text-left text-xs text-amber-900 dark:text-amber-200"
          >
            {missing.map((m) => (
              <li key={m} className="flex items-start gap-1.5">
                <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-700" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Código: <code className="font-mono">phase2_photos:{reason}</code>
        </p>
        {reason === 'no_service' && phase2RetryStatus !== 'idle' && (
          <div
            data-testid="phase2-photos-retry-status"
            data-status={phase2RetryStatus}
            className={
              phase2RetryStatus === 'running'
                ? 'mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-100/60 px-2.5 py-1 text-[11px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100'
                : 'mx-auto mt-2 flex max-w-xs flex-col items-center gap-1.5 rounded-md border border-bet-error-border bg-bet-error-soft p-2 text-[11px] text-bet-error'
            }
            role="status"
            aria-live="polite"
          >
            {phase2RetryStatus === 'running' ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-700/40 border-t-amber-700" aria-hidden />
                <span>Tentando recuperar seu rascunho automaticamente…</span>
              </>
            ) : (
              <>
                <span className="font-semibold">Não consegui recuperar automaticamente.</span>
                <button
                  type="button"
                  data-testid="phase2-photos-retry-manual"
                  onClick={onRetryManual}
                  className="rounded-md border border-bet-error-border bg-white/70 px-2 py-1 text-[11px] font-semibold text-bet-error hover:bg-white"
                >
                  Tentar manualmente
                </button>
              </>
            )}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2">
          {reason === 'no_session' ? (
            <button
              type="button"
              onClick={onLogin}
              className="h-11 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 text-sm font-bold text-white shadow-md hover:opacity-95"
            >
              Fazer login novamente
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onBackToDetails}
                className="h-11 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 text-sm font-bold text-white shadow-md hover:opacity-95"
              >
                Voltar e revisar o serviço
              </button>
              <button
                type="button"
                data-testid="phase2-photos-recover-draft"
                onClick={onRetryManual}
                className="h-10 rounded-xl border border-amber-400/60 text-sm font-semibold text-amber-900 hover:bg-amber-100/60 dark:text-amber-100 dark:hover:bg-amber-500/10"
              >
                Recuperar rascunho do serviço
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onSkip}
            className="h-10 rounded-xl text-sm text-muted-foreground hover:text-foreground"
          >
            Pular fotos por enquanto
          </button>
        </div>
      </div>
      <ReportWizardErrorButton
        step={`phase2_photos:${reason}`}
        componentName="OnboardingV2Shell"
        label="Reportar para o suporte"
        contextSnapshot={{
          code: `phase2_photos:${reason}`,
          missing_fields: missing,
          category: context.primaryCategoryId,
          city: context.city,
          state: context.stateUF,
          has_provider: !!context.providerId,
          has_first_service: !!context.firstServiceId,
          lastPersistError: context.lastPersistError
            ? { message: context.lastPersistError.message, code: context.lastPersistError.code || null }
            : null,
        }}
      />
    </section>
  );
};

export default Phase2PhotosBlockedCard;
