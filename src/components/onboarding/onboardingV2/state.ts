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

const PHASE_ORDER: OnboardingPhase[] = [
  'phase1_action',
  'phase1_kind',
  'phase1_location',
  'phase1_contact',
  'phase2_service',
  'phase2_details',
  'phase2_photos',
  'phase3_celebration',
  'phase4_document',
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
    neighborhood: '',
    bio: '',
    instagram_url: '',
    facebook_url: '',
    primary_category_id: null,
    working_hours: '',
  },
  service: {
    service_name: '',
    description: '',
    category_ids: [],
    cities_served: [],
    starting_price_brl: null,
    working_hours: '',
  },
  phase: 'phase1_action',
  providerId: null,
  firstServiceId: null,
};

export type OnboardingAction =
  | { type: 'PATCH_PROFILE'; patch: Partial<OnboardingProfileData> }
  | { type: 'PATCH_SERVICE'; patch: Partial<OnboardingFirstServiceData> }
  | { type: 'GO_TO'; phase: OnboardingPhase }
  | { type: 'NEXT' }
  | { type: 'SKIP_TO_NEXT' }
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
    case 'NEXT':
    case 'SKIP_TO_NEXT':
      return { ...state, phase: nextPhase(state.phase) };
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
