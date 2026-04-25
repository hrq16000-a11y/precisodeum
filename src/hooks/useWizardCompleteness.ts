import { useMemo } from 'react';
import type {
  ProfileWizardData,
  WizardCompletenessResult,
  WizardMissingField,
  WizardScoredField,
} from '@/components/onboarding/profileWizard/types';

/**
 * Pesos oficiais do score de completude do ProfileWizard.
 * Soma intencional = 100. Alterar com cuidado: a barra de progresso
 * e os textos de "falta X" derivam diretamente daqui.
 */
export const WIZARD_SCORE_WEIGHTS: Record<WizardScoredField, number> = {
  full_name: 15,
  whatsapp: 15,
  category: 20,
  bio: 20,
  avatar: 15,
  location: 15,
};

/** Rótulos amigáveis para exibir "o que falta". */
const FIELD_LABELS: Record<WizardScoredField, string> = {
  full_name: 'Nome completo',
  whatsapp: 'WhatsApp válido',
  category: 'Categoria principal',
  bio: 'Bio com pelo menos 20 caracteres',
  avatar: 'Foto de perfil',
  location: 'Cidade e estado',
};

/** Considera WhatsApp válido se tiver 10–13 dígitos (cobre BR com/sem DDI). */
function isWhatsappValid(raw: string | undefined | null): boolean {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

/**
 * Avalia cada critério do score. Retornar `true` significa "completo".
 * Mantido como função pura para facilitar testes unitários.
 */
function evaluateFields(data: Partial<ProfileWizardData>): Record<WizardScoredField, boolean> {
  const fullName = (data.full_name ?? '').trim();
  const bio = (data.bio ?? '').trim();
  const category = (data.category ?? '').trim();
  const city = (data.city ?? '').trim();
  const state = (data.state ?? '').trim();

  return {
    full_name: fullName.length >= 3,
    whatsapp: isWhatsappValid(data.whatsapp),
    category: category.length > 0 && category !== 'all',
    bio: bio.length >= 20,
    avatar: !!data.avatar_url,
    location: city.length > 0 && state.length === 2,
  };
}

/**
 * Hook que calcula o score de completude (0–100) do wizard a partir
 * do estado atual do formulário, junto com a lista priorizada do que
 * ainda falta preencher.
 */
export function useWizardCompleteness(
  data: Partial<ProfileWizardData>,
): WizardCompletenessResult {
  return useMemo(() => {
    const evaluated = evaluateFields(data);

    let total = 0;
    const missing: WizardMissingField[] = [];

    (Object.keys(WIZARD_SCORE_WEIGHTS) as WizardScoredField[]).forEach((field) => {
      const weight = WIZARD_SCORE_WEIGHTS[field];
      if (evaluated[field]) {
        total += weight;
      } else {
        missing.push({ field, label: FIELD_LABELS[field], weight });
      }
    });

    // Ordena os faltantes por maior peso primeiro (impacto no score).
    missing.sort((a, b) => b.weight - a.weight);

    return {
      percentage: Math.max(0, Math.min(100, Math.round(total))),
      missing,
      weights: WIZARD_SCORE_WEIGHTS,
    };
  }, [
    data.full_name,
    data.whatsapp,
    data.category,
    data.bio,
    data.avatar_url,
    data.city,
    data.state,
  ]);
}
