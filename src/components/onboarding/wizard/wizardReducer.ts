/**
 * Wizard Reducer Unificado — fonte ÚNICA de verdade do onboarding linear.
 *
 * Consolidação Fase 2:
 *  - Define `UnifiedPhase` (enum linear das 19 etapas + 'done').
 *  - Define `WizardState` consolidando dados de Triagem (ex-V3) +
 *    Criação de Serviço & Perfil (ex-V2) num único contrato.
 *  - Define `WizardAction` (NEXT/BACK/GO_TO/PATCH/HYDRATE/SET_*).
 *  - Expõe `wizardReducer`, `initialWizardState` e helpers de mapeamento.
 *
 * Compatibilidade: os sub-reducers internos `betReducer` e `onboardingReducer`
 * (V2) seguem vivos como detalhe de implementação encapsulado pelos
 * orquestradores `TriageOrchestrator` e `MainOrchestrator` (componentes
 * privados dentro do WizardShell). A persistência (createProvider,
 * create_service_atomic, patches) também permanece encapsulada nesses
 * orquestradores — o WizardShell continua sendo a única fachada pública.
 */

import type { OnboardingPhase, OnboardingProfileData, OnboardingFirstServiceData } from './phases/v2/types';
import type { BetState } from './phases/bet/types';

// ─────────────────────────────────────────────────────────────────────────────
// Enum unificado (19 fases visíveis + 'done')
// ─────────────────────────────────────────────────────────────────────────────

export type UnifiedPhase =
  // Triagem (ex-V3 Bet Mode) — fases 1..7
  | 'triage_identity'
  | 'triage_who'
  | 'triage_client_city'
  | 'triage_pro_kind'
  | 'triage_pro_document'
  | 'triage_pro_location'
  | 'triage_celebration'
  // Criação de Serviço & Perfil (ex-V2) — fases 8..19
  | 'main_action'
  | 'main_kind'
  | 'main_location'
  | 'main_contact'
  | 'main_service'
  | 'main_service_details'
  | 'main_photos'
  | 'main_celebration'
  | 'main_document'
  | 'main_avatar'
  | 'main_extras_a'
  | 'main_extras_b'
  | 'main_more_services'
  | 'main_portfolio_albums'
  | 'done';

// UNIFIED_PHASE_ORDER — régua oficial da jornada (sincronizada com REVIEW_PHASE_ORDER).
// As fases main_action/main_kind/main_location/main_contact foram expurgadas em
// mai/2026 (memória "Expurgo Phase1 V2") e NÃO renderizam UI; mantemos os tipos
// no `UnifiedPhase` apenas para compat de telemetria histórica e telas legadas
// (ex: DashboardAssistantPage), mas elas NÃO entram na régua de navegação.
export const UNIFIED_PHASE_ORDER: UnifiedPhase[] = [
  'triage_identity',
  'triage_who',
  'triage_client_city',
  'triage_pro_kind',
  'triage_pro_document',
  'triage_pro_location',
  'triage_celebration',
  'main_service',
  'main_service_details',
  'main_photos',
  'main_celebration',
  'main_document',
  'main_avatar',
  'main_extras_a',
  'main_extras_b',
  'main_more_services',
  'main_portfolio_albums',
  'done',
];

export const PROVIDER_WIZARD_PHASE_ORDER: UnifiedPhase[] = [
  'triage_identity',
  'triage_who',
  'triage_pro_kind',
  'triage_pro_document',
  'triage_pro_location',
  'triage_celebration',
  'main_service',
  'main_service_details',
  'main_photos',
  'main_celebration',
  'main_document',
  'main_avatar',
  'main_extras_a',
  'main_extras_b',
  'main_more_services',
  'main_portfolio_albums',
  'done',
];

/**
 * REVIEW_PHASE_ORDER / REVIEW_TOTAL_STEPS / helpers de navegação foram
 * movidos para `wizardReviewSteps.ts` (fonte única, compartilhada com o
 * Dashboard Assistant). Re-exportamos aqui para manter compat de imports
 * antigos. NÃO redefina essas constantes neste arquivo.
 */
export {
  REVIEW_PHASE_ORDER,
  REVIEW_TOTAL_STEPS,
  isReviewPhaseRenderable,
  nextRenderableReviewPhase,
  prevRenderableReviewPhase,
} from './wizardReviewSteps';

/** Quantidade de fases visíveis (exclui 'done'). */
export const UNIFIED_VISIBLE_PHASES = UNIFIED_PHASE_ORDER.length - 1;

export function unifiedPhaseIndex(phase: UnifiedPhase): number {
  return Math.max(0, UNIFIED_PHASE_ORDER.indexOf(phase));
}

/** Próxima fase unificada (linear). */
export function nextUnifiedPhase(phase: UnifiedPhase): UnifiedPhase {
  const i = unifiedPhaseIndex(phase);
  if (i === -1 || i === UNIFIED_PHASE_ORDER.length - 1) return 'done';
  return UNIFIED_PHASE_ORDER[i + 1];
}

/** Fase anterior unificada (linear, sem retroceder antes do início). */
export function prevUnifiedPhase(phase: UnifiedPhase): UnifiedPhase {
  const i = unifiedPhaseIndex(phase);
  if (i <= 0) return UNIFIED_PHASE_ORDER[0];
  return UNIFIED_PHASE_ORDER[i - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado consolidado
// ─────────────────────────────────────────────────────────────────────────────

export interface WizardState {
  phase: UnifiedPhase;
  /** Dados coletados na triagem (Bet Mode). */
  triage: BetState;
  /** Dados coletados na criação de serviço & perfil (V2). */
  profile: OnboardingProfileData;
  service: OnboardingFirstServiceData;
  providerId: string | null;
  firstServiceId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamentos legacy ↔ unified (mantidos até a fusão profunda da persistência)
// ─────────────────────────────────────────────────────────────────────────────

export function mapTriagePhaseToUnified(betPhase: string): UnifiedPhase {
  switch (betPhase) {
    case 'identity': return 'triage_identity';
    case 'who': return 'triage_who';
    case 'client_city': return 'triage_client_city';
    case 'pro_kind': return 'triage_pro_kind';
    case 'pro_document': return 'triage_pro_document';
    case 'pro_location': return 'triage_pro_location';
    case 'celebration': return 'triage_celebration';
    case 'done': return 'main_action';
    default: return 'triage_identity';
  }
}

export function mapMainPhaseToUnified(v2Phase: string): UnifiedPhase {
  switch (v2Phase as OnboardingPhase) {
    case 'phase2_service': return 'main_service';
    case 'phase2_details': return 'main_service_details';
    case 'phase2_photos': return 'main_photos';
    case 'phase3_celebration': return 'main_celebration';
    case 'phase4_document': return 'main_document';
    case 'phase4_avatar': return 'main_avatar';
    case 'phase4_extras_a': return 'main_extras_a';
    case 'phase4_extras_b': return 'main_extras_b';
    case 'done': return 'done';
    default: return 'main_action';
  }
}

export function mapUnifiedToTriagePhase(phase: UnifiedPhase): import('./phases/bet/types').BetPhase {
  switch (phase) {
    case 'triage_identity': return 'identity';
    case 'triage_who': return 'who';
    case 'triage_client_city': return 'client_city';
    case 'triage_pro_kind': return 'pro_kind';
    case 'triage_pro_document': return 'pro_document';
    case 'triage_pro_location': return 'pro_location';
    case 'triage_celebration': return 'celebration';
    default: return 'identity';
  }
}

export function mapUnifiedToMainPhase(phase: UnifiedPhase): OnboardingPhase {
  switch (phase) {
    // main_action/kind/location/contact não existem mais em V2 — caem no
    // início do fluxo V2 vivo (phase2_service). Identidade/local/contato
    // são responsabilidade da Triagem (Bet Mode).
    case 'main_action':
    case 'main_kind':
    case 'main_location':
    case 'main_contact':
    case 'main_service': return 'phase2_service';
    case 'main_service_details': return 'phase2_details';
    case 'main_photos': return 'phase2_photos';
    case 'main_celebration': return 'phase3_celebration';
    case 'main_document': return 'phase4_document';
    case 'main_avatar': return 'phase4_avatar';
    case 'main_extras_a': return 'phase4_extras_a';
    case 'main_extras_b': return 'phase4_extras_b';
    case 'done': return 'done';
    default: return 'phase2_service';
  }
}

export const UNIFIED_PHASE_LABELS: Record<UnifiedPhase, string> = {
  triage_identity: 'Identificação',
  triage_who: 'Quem é você',
  triage_client_city: 'Sua cidade',
  triage_pro_kind: 'Tipo de conta',
  triage_pro_document: 'Documento',
  triage_pro_location: 'Cidade base',
  triage_celebration: 'Conquista inicial',
  main_action: 'Atuação',
  main_kind: 'PF ou PJ',
  main_location: 'Localização',
  main_contact: 'Contato',
  main_service: 'Categoria do serviço',
  main_service_details: 'Detalhes do serviço',
  main_photos: 'Fotos do serviço',
  main_celebration: 'Serviço criado!',
  main_document: 'Documento',
  main_avatar: 'Foto de perfil',
  main_extras_a: 'Bairro e bio',
  main_extras_b: 'Redes sociais',
  main_more_services: 'Mais serviços (opcional)',
  main_portfolio_albums: 'Álbuns de portfólio (opcional)',
  done: 'Concluído',
};

// ─────────────────────────────────────────────────────────────────────────────
// Reducer linear unificado
// ─────────────────────────────────────────────────────────────────────────────

export type WizardAction =
  | { type: 'NEXT_PHASE' }
  | { type: 'PREV_PHASE' }
  | { type: 'GO_TO_PHASE'; phase: UnifiedPhase }
  | { type: 'PATCH_TRIAGE'; patch: Partial<BetState> }
  | { type: 'PATCH_PROFILE'; patch: Partial<OnboardingProfileData> }
  | { type: 'PATCH_SERVICE'; patch: Partial<OnboardingFirstServiceData> }
  | { type: 'SET_PROVIDER_ID'; id: string }
  | { type: 'SET_FIRST_SERVICE_ID'; id: string }
  | { type: 'HYDRATE'; state: Partial<WizardState> };

export const initialWizardState: WizardState = {
  phase: 'triage_identity',
  triage: {
    full_name: '',
    whatsapp: '',
    intent: null,
    city: '',
    state: '',
    neighborhood: '',
    latitude: null,
    longitude: null,
    ibge_code: null,
    location_source: null,
    gps_accuracy_m: null,
    neighborhood_source: null,
    pro_kind: null,
    document: '',
    company_name: '',
    street: '',
    street_number: '',
    complement: '',
    postal_code: '',
    show_full_address: false,
    street_suggested: '',
    street_suggested_cep: '',
    street_confirmed: false,
    bairro_sugerido_cep: '',
    cep_history: [],
    avatar_url: null,
    avatar_source: null,
    avatar_seed: 0,
    points: 0,
    rewards: {
      name: false,
      whatsapp: false,
      intent: false,
      city: false,
      pro_kind: false,
      document: false,
    },
    phase: 'identity',
  },
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
  },
  providerId: null,
  firstServiceId: null,
};

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'NEXT_PHASE':
      return { ...state, phase: nextUnifiedPhase(state.phase) };
    case 'PREV_PHASE':
      return { ...state, phase: prevUnifiedPhase(state.phase) };
    case 'GO_TO_PHASE':
      return { ...state, phase: action.phase };
    case 'PATCH_TRIAGE':
      return { ...state, triage: { ...state.triage, ...action.patch } };
    case 'PATCH_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'PATCH_SERVICE':
      return { ...state, service: { ...state.service, ...action.patch } };
    case 'SET_PROVIDER_ID':
      return { ...state, providerId: action.id };
    case 'SET_FIRST_SERVICE_ID':
      return { ...state, firstServiceId: action.id };
    case 'HYDRATE':
      return {
        ...state,
        ...action.state,
        triage: { ...state.triage, ...(action.state.triage || {}) },
        profile: { ...state.profile, ...(action.state.profile || {}) },
        service: { ...state.service, ...(action.state.service || {}) },
      };
    default:
      return state;
  }
}

/**
 * hydrateWizardState — substituto único do antigo
 * `resolveOnboardingV2SeedState` + `internalHandoffFromTriage` flag.
 *
 * Resolve a fase inicial a partir de dados já gravados em
 * profile/provider, sem nunca regredir uma fase já alcançada localmente.
 */
export function hydrateWizardState(input: {
  current?: Partial<WizardState> | null;
  fromProfile?: { phase: UnifiedPhase; patch: Partial<WizardState> } | null;
}): Partial<WizardState> {
  const current = input.current || {};
  const fromProfile = input.fromProfile;
  if (!fromProfile) return current;

  const currentIdx = current.phase ? unifiedPhaseIndex(current.phase) : -1;
  const seedIdx = unifiedPhaseIndex(fromProfile.phase);
  // Anti-regressão: se o usuário já está numa fase >= seed, mantém.
  const phase = currentIdx >= seedIdx ? (current.phase as UnifiedPhase) : fromProfile.phase;

  return {
    ...fromProfile.patch,
    ...current,
    phase,
  };
}
