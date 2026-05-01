/**
 * WizardMode — contrato público do modo de operação do WizardShell.
 *
 * Substitui o boolean `reviewMode` por um discriminador explícito que
 * permite às fases adaptarem a UX (ex.: botão "Pular" só faz sentido em
 * `edit_profile`, quando os dados já estão salvos no banco).
 *
 * Os 3 modos são MUTUAMENTE EXCLUSIVOS e cobrem 100% dos cenários:
 *  - `new_signup`: usuário novo, fluxo completo da triagem ao serviço.
 *  - `edit_profile`: usuário já completou o onboarding e voltou para
 *    revisar/editar uma seção (ex.: botão "Editar perfil" no Dashboard).
 *  - `add_service`: perfil já existe; foco é cadastrar um serviço novo,
 *    pulando a triagem mas mantendo a fase de criação.
 *
 * O alias deprecated `reviewMode: true` mapeia para `mode='edit_profile'`.
 */
import { createContext, useContext } from 'react';
import type { WizardState, UnifiedPhase } from './wizardReducer';

export type WizardMode = 'new_signup' | 'edit_profile' | 'add_service';

export interface WizardModeContextValue {
  mode: WizardMode;
  /** True quando estamos editando um perfil existente. Atalho de leitura. */
  isEditing: boolean;
}

export const WizardModeContext = createContext<WizardModeContextValue>({
  mode: 'new_signup',
  isEditing: false,
});

export function useWizardMode(): WizardModeContextValue {
  return useContext(WizardModeContext);
}

/**
 * Resolve o modo efetivo a partir das props públicas, mantendo
 * compatibilidade com o boolean `reviewMode` antigo (alias depreciado).
 */
export function resolveWizardMode(input: {
  mode?: WizardMode;
  reviewMode?: boolean;
}): WizardMode {
  if (input.mode) return input.mode;
  if (input.reviewMode) return 'edit_profile';
  return 'new_signup';
}

/**
 * isPhaseFullyCompleted — checa se TODOS os campos obrigatórios da fase
 * já estão salvos. Usado pelo botão "Pular" em `edit_profile` para
 * exibir o atalho apenas quando pular não deixa a fase incompleta.
 *
 * Convenções:
 *  - Strings: trim+length > 0
 *  - Arrays: length > 0
 *  - Numbers: !== null && finite
 *
 * Não inclui fases sem campos obrigatórios (ex.: celebrações, more_services).
 */
export function isPhaseFullyCompleted(state: WizardState, phase: UnifiedPhase): boolean {
  const { profile, service } = state;
  const s = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  const arr = (v: unknown) => Array.isArray(v) && v.length > 0;

  switch (phase) {
    case 'main_action':
    case 'main_kind':
      return s(profile.profile_type) && s(profile.kind);
    case 'main_location':
      return s(profile.city) && s(profile.state);
    case 'main_contact':
      return s(profile.full_name) && s(profile.whatsapp);
    case 'main_service':
      return arr(service.category_ids);
    case 'main_service_details':
      return s(service.service_name) && s(service.description) && arr(service.cities_served);
    case 'main_photos':
      // Fotos são opcionais por design — sempre considera "completo o suficiente"
      // para permitir Pular em edit_profile.
      return true;
    case 'main_document':
      return s(profile.document);
    case 'main_avatar':
      return s(profile.avatar_url);
    case 'main_extras_a':
      return s(profile.neighborhood) && s(profile.bio);
    case 'main_extras_b':
      // Redes sociais são todas opcionais; em edit_profile, sempre permitir Pular.
      return true;
    default:
      return false;
  }
}
