/**
 * OnboardingV2 — reducer central.
 *
 * Mantém o estado do wizard inteiro em um único lugar para que passos
 * futuros herdem dados de passos passados sem perguntar de novo.
 *
 * Mantém compatibilidade com a persistência existente em providers/profiles
 * (via providerPayload.normalizeProviderPayload).
 */

import type {
  OnboardingState,
  OnboardingPhase,
  OnboardingProfileData,
  OnboardingFirstServiceData,
} from './types';

// Ordem das fases vivas do reducer V2 (após expurgo das phase1_* — mai/2026).
// A triagem (Bet Mode) cobre identidade/local/contato; a fase principal começa
// direto na criação do 1º serviço.
const PHASE_ORDER: OnboardingPhase[] = [
  'phase2_service',
  'phase2_details',
  'phase2_photos',
  'phase3_celebration',
  'phase4_document',
  'phase4_avatar',
  'phase4_extras_a',
  'phase4_extras_b',
  'done',
];

export const initialOnboardingState: OnboardingState = {
  profile: {
    profile_type: undefined,
    kind: 'pf',
    full_name: '',
    whatsapp: '',
    document: '',
    city: '',
    state: '',
    avatar_url: null,
    years_experience: null,
    neighborhood: '',
    bio: '',
    instagram_url: '',
    facebook_url: '',
    website_url: '',
    primary_category_id: null,
    working_hours: '',
    go_online: true,
    avatar_source: null,
    avatar_seed: 0,
  },
  service: {
    service_name: '',
    description: '',
    category_ids: [],
    cities_served: [],
    starting_price_brl: null,
    working_days: [],
    working_hours: '',
    working_hours_struct: null,
  },
  phase: 'phase2_service',
  userRef: null,
  providerId: null,
  firstServiceId: null,
  returnToPhase: null,
};

export type OnboardingAction =
  | { type: 'PATCH_PROFILE'; patch: Partial<OnboardingProfileData> }
  | { type: 'PATCH_SERVICE'; patch: Partial<OnboardingFirstServiceData> }
  | { type: 'GO_TO'; phase: OnboardingPhase }
  | { type: 'GO_TO_REPAIR'; from: OnboardingPhase }
  | { type: 'RETURN_FROM_REPAIR' }
  | { type: 'NEXT' }
  | { type: 'SKIP_TO_NEXT' }
  | { type: 'SET_USER_REF'; userRef: string }
  | { type: 'SET_PROVIDER_ID'; id: string }
  | { type: 'SET_FIRST_SERVICE_ID'; id: string }
  | { type: 'HYDRATE'; state: Partial<OnboardingState> };

function nextPhase(current: OnboardingPhase): OnboardingPhase {
  const i = PHASE_ORDER.indexOf(current);
  if (i === -1 || i === PHASE_ORDER.length - 1) return 'done';
  return PHASE_ORDER[i + 1];
}

export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {
    case 'PATCH_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'PATCH_SERVICE':
      return { ...state, service: { ...state.service, ...action.patch } };
    case 'GO_TO':
      return { ...state, phase: action.phase };
    case 'GO_TO_REPAIR':
      // Fase auxiliar (FORA do PHASE_ORDER). Guarda a fase de origem para
      // que `RETURN_FROM_REPAIR` consiga restaurar o fluxo principal.
      return { ...state, phase: 'phase_repair_contact', returnToPhase: action.from };
    case 'RETURN_FROM_REPAIR':
      // Volta para a fase guardada (ou phase2_service como fallback seguro).
      return { ...state, phase: state.returnToPhase || 'phase2_service', returnToPhase: null };
    case 'NEXT':
    case 'SKIP_TO_NEXT':
      // Se estamos na fase auxiliar, NEXT sempre retorna ao fluxo principal.
      if (state.phase === 'phase_repair_contact') {
        return { ...state, phase: state.returnToPhase || 'phase2_service', returnToPhase: null };
      }
      return { ...state, phase: nextPhase(state.phase) };
    case 'SET_USER_REF':
      return { ...state, userRef: action.userRef };
    case 'SET_PROVIDER_ID':
      return { ...state, providerId: action.id };
    case 'SET_FIRST_SERVICE_ID':
      return { ...state, firstServiceId: action.id };
    case 'HYDRATE':
      return {
        ...state,
        ...action.state,
        profile: { ...state.profile, ...(action.state.profile || {}) },
        service: { ...state.service, ...(action.state.service || {}) },
      };
    default:
      return state;
  }
}

/** Total de fases visíveis para a barra de progresso (excluindo 'done'). */
export const VISIBLE_PHASES_COUNT = PHASE_ORDER.length - 1;

export function phaseIndex(phase: OnboardingPhase): number {
  return Math.max(0, PHASE_ORDER.indexOf(phase));
}
