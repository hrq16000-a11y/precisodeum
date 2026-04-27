/**
 * reviewSectionMap — fonte única de verdade para o que cada seção do
 * Review Step edita: para qual fase navegar e qual campo focar/destacar.
 *
 * Centralizar evita drift entre Review e fases (ex: alguém renomeia 'bio'
 * mas esquece de atualizar o highlight). Adicione aqui ao introduzir
 * novas seções no Review.
 */
import type { OnboardingPhase } from './types';

export interface ReviewSectionConfig {
  /** Identificador estável (debug/telemetria). */
  key: string;
  /** Rótulo exibido no Review. */
  label: string;
  /** Fase para a qual o "Editar" navega. */
  phase: OnboardingPhase;
  /** Campo (do estado) que recebe foco/highlight ao chegar na fase. */
  focusField?: string;
}

export const REVIEW_SECTIONS: Record<string, ReviewSectionConfig> = {
  identity:    { key: 'identity',    label: 'Identidade',     phase: 'phase1_contact',  focusField: 'full_name' },
  document:    { key: 'document',    label: 'Documento',      phase: 'phase4_document', focusField: 'document' },
  service:     { key: 'service',     label: 'Serviço',        phase: 'phase2_service',  focusField: 'service_name' },
  logistics:   { key: 'logistics',   label: 'Logística',      phase: 'phase2_details',  focusField: 'cities_served' },
  bioBairro:   { key: 'bioBairro',   label: 'Bairro & Bio',   phase: 'phase4_extras_a', focusField: 'bio' },
  avatar:      { key: 'avatar',      label: 'Foto de perfil', phase: 'phase4_avatar',   focusField: 'avatar_url' },
  socials:     { key: 'socials',     label: 'Redes sociais',  phase: 'phase4_extras_b', focusField: 'instagram_url' },
};

/** Lista de campos focáveis conhecidos — útil para validação. */
export const FOCUSABLE_FIELDS = new Set(
  Object.values(REVIEW_SECTIONS).map((s) => s.focusField).filter(Boolean) as string[],
);
