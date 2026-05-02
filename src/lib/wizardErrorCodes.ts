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
  PHASE2_PHOTOS_NO_SERVICE: 'phase2_photos:no_service',
  PHASE2_PHOTOS_NO_SESSION: 'phase2_photos:no_session',
  PHASE2_PHOTOS_RECOVER_ATTEMPT: 'phase2_photos:recover_attempt',
  PHASE2_PHOTOS_RECOVER_AUTO: 'phase2_photos:recover_auto',
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
