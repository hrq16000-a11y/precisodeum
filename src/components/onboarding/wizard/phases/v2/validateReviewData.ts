/**
 * Pré-validação do Review Step.
 *
 * Bloqueia "Confirmar e Publicar" quando campos críticos estão em
 * formato inválido. Cada erro aponta para a section_key do reviewSectionMap
 * para que o usuário possa clicar em "Editar" direto na falha.
 */
import type { OnboardingProfileData, OnboardingFirstServiceData } from './types';

export interface ReviewValidationError {
  /** chave em REVIEW_SECTIONS para deep-link de Editar */
  section: string;
  message: string;
}

const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');

function validWhatsapp(raw: string): boolean {
  const d = onlyDigits(raw);
  // Aceita 10 (fixo) ou 11 (celular) dígitos, com DDD nacional
  return d.length === 10 || d.length === 11;
}

function validDoc(raw: string, kind: 'pf' | 'pj'): boolean {
  if (!raw) return true; // documento é opcional no fluxo
  const d = onlyDigits(raw);
  return kind === 'pj' ? d.length === 14 : d.length === 11;
}

export function validateReviewData(
  profile: OnboardingProfileData,
  service: OnboardingFirstServiceData,
): ReviewValidationError[] {
  const errors: ReviewValidationError[] = [];

  if (!profile.full_name?.trim() || profile.full_name.trim().length < 2) {
    errors.push({ section: 'identity', message: 'Nome completo é obrigatório.' });
  }

  if (!validWhatsapp(profile.whatsapp)) {
    errors.push({ section: 'identity', message: 'WhatsApp inválido — informe DDD + número.' });
  }

  if (profile.document && !validDoc(profile.document, profile.kind)) {
    errors.push({
      section: 'document',
      message: profile.kind === 'pj' ? 'CNPJ inválido (14 dígitos).' : 'CPF inválido (11 dígitos).',
    });
  }

  if (!service.service_name?.trim() || !service.category_ids?.length) {
    errors.push({ section: 'service', message: 'Selecione uma categoria de serviço.' });
  }

  return errors;
}
