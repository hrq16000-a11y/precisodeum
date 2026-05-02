/**
 * Regressão wizardErrorCodes — códigos canônicos.
 *
 * Trava os valores literais usados em logs/telemetria/error_reports para que
 * agrupamentos no painel de suporte não quebrem com renomeações silenciosas.
 */
import { describe, it, expect } from 'vitest';
import { WIZARD_ERROR_CODES, phase2PhotosBlockCode } from '@/lib/wizardErrorCodes';

describe('WIZARD_ERROR_CODES', () => {
  it('mantém códigos exatos esperados', () => {
    expect(WIZARD_ERROR_CODES.PHASE2_PHOTOS_NO_SERVICE).toBe('phase2_photos:no_service');
    expect(WIZARD_ERROR_CODES.PHASE2_PHOTOS_NO_SESSION).toBe('phase2_photos:no_session');
    expect(WIZARD_ERROR_CODES.PHASE2_PHOTOS_RECOVER_ATTEMPT).toBe('phase2_photos:recover_attempt');
    expect(WIZARD_ERROR_CODES.PHASE2_PHOTOS_RECOVER_AUTO).toBe('phase2_photos:recover_auto');
  });

  it('phase2PhotosBlockCode mapeia razão para código canônico', () => {
    expect(phase2PhotosBlockCode('no_service')).toBe('phase2_photos:no_service');
    expect(phase2PhotosBlockCode('no_session')).toBe('phase2_photos:no_session');
  });
});
