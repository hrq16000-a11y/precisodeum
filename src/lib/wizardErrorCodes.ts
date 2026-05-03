/**
 * wizardErrorCodes — enumeração canônica dos códigos de erro do wizard.
 *
 * Toda telemetria (`onboarding_events.meta.code`), logs de console e o vínculo
 * com `error_reports` (via ReportWizardErrorButton) DEVEM usar estes valores
 * para garantir consistência e permitir que o suporte agrupe ocorrências.
 *
 * Regra: snake_case + namespace por fase (`phase2_photos:no_session`).
 */

export const WIZARD_ERROR_CODES = {
  // Bloqueios da fase de fotos (phase2_photos)
  PHASE2_PHOTOS_NO_SERVICE: 'phase2_photos:no_service',
  PHASE2_PHOTOS_NO_SESSION: 'phase2_photos:no_session',
  // Recuperação de rascunho do serviço
  PHASE2_PHOTOS_RECOVER_ATTEMPT: 'phase2_photos:recover_attempt',
  PHASE2_PHOTOS_RECOVER_AUTO: 'phase2_photos:recover_auto',
  PHASE2_PHOTOS_RECOVER_BACKOFF: 'phase2_photos:recover_backoff',
  PHASE2_PHOTOS_RECOVER_EXHAUSTED: 'phase2_photos:recover_exhausted',
  PHASE2_PHOTOS_RECOVER_SUCCESS: 'phase2_photos:recover_success',
  // Telemetria do diálogo de suporte
  SUPPORT_REPORT_OPEN: 'support_report:open',
  SUPPORT_REPORT_SENT: 'support_report:sent',
  SUPPORT_REPORT_FAILED: 'support_report:failed',
  SUPPORT_REPORT_ATTACHMENT_FAILED: 'support_report:attachment_failed',
} as const;

export type WizardErrorCode =
  (typeof WIZARD_ERROR_CODES)[keyof typeof WIZARD_ERROR_CODES];

/** Constrói o código de bloqueio de phase2_photos a partir da razão. */
export function phase2PhotosBlockCode(
  reason: 'no_service' | 'no_session',
): WizardErrorCode {
  return reason === 'no_session'
    ? WIZARD_ERROR_CODES.PHASE2_PHOTOS_NO_SESSION
    : WIZARD_ERROR_CODES.PHASE2_PHOTOS_NO_SERVICE;
}

/**
 * Backoff exponencial canônico para retries de recuperação de rascunho.
 * 3 tentativas: imediata, 800 ms, 2400 ms (~3.2s no pior caso).
 *
 * Usar via `RECOVER_BACKOFF_DELAYS_MS[attemptIndex]`.
 */
export const RECOVER_BACKOFF_DELAYS_MS = [0, 800, 2400] as const;
export const RECOVER_MAX_ATTEMPTS = RECOVER_BACKOFF_DELAYS_MS.length;
