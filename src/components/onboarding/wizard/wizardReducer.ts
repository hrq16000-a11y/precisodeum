/**
 * Wizard Reducer Unificado — fonte única de verdade da ordem das fases.
 *
 * Combina as fases da Triagem (ex-V3 Bet Mode) e da Criação de Serviço
 * & Perfil (ex-V2) em uma única sequência linear `OnboardingPhase`, usada
 * pelo WizardShell para calcular progresso global e por testes E2E como
 * referência canônica do fluxo.
 *
 * IMPORTANTE — esta é a Fase 1 (conservadora) da consolidação:
 *  - Os reducers internos `BetModeShell.reducer` e `onboardingReducer` (V2)
 *    continuam vivos e ainda alimentam seus respectivos sub-shells. Este
 *    arquivo NÃO os substitui ainda.
 *  - O WizardShell usa esta lista apenas para:
 *      a) calcular a barra de progresso global (índice da fase atual);
 *      b) expor um único enum/array consultável pelo restante do app
 *         (testes, telemetria, debug logs).
 *  - A fusão profunda (reducer único, eliminação do flag
 *    `internalHandoffFromTriage` e do `resolveOnboardingV2SeedState`)
 *    acontece no próximo turno, com atualização dos testes E2E.
 */

export type UnifiedPhase =
  // Triagem (ex-V3 Bet Mode)
  | 'triage_identity'
  | 'triage_who'
  | 'triage_client_city'
  | 'triage_pro_kind'
  | 'triage_pro_document'
  | 'triage_pro_location'
  | 'triage_celebration'
  // Criação de Serviço & Perfil (ex-V2)
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
  | 'done';

/**
 * Ordem oficial e linear de TODAS as fases do onboarding unificado.
 * Usada para calcular progresso global e para testes E2E que validam
 * que o wizard nunca retrocede para uma fase anterior.
 */
export const UNIFIED_PHASE_ORDER: UnifiedPhase[] = [
  'triage_identity',
  'triage_who',
  'triage_client_city',
  'triage_pro_kind',
  'triage_pro_document',
  'triage_pro_location',
  'triage_celebration',
  'main_action',
  'main_kind',
  'main_location',
  'main_contact',
  'main_service',
  'main_service_details',
  'main_photos',
  'main_celebration',
  'main_document',
  'main_avatar',
  'main_extras_a',
  'main_extras_b',
  'done',
];

/** Quantidade de fases visíveis (exclui 'done'). */
export const UNIFIED_VISIBLE_PHASES = UNIFIED_PHASE_ORDER.length - 1;

export function unifiedPhaseIndex(phase: UnifiedPhase): number {
  return Math.max(0, UNIFIED_PHASE_ORDER.indexOf(phase));
}

/**
 * Mapeia a fase interna do BetModeShell (sub-reducer da Triagem) para a
 * fase unificada usada pela barra de progresso global.
 */
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

/**
 * Mapeia a fase interna do OnboardingV2Shell (sub-reducer da Criação de
 * Serviço & Perfil) para a fase unificada.
 */
export function mapMainPhaseToUnified(v2Phase: string): UnifiedPhase {
  switch (v2Phase) {
    case 'phase1_action': return 'main_action';
    case 'phase1_kind': return 'main_kind';
    case 'phase1_location': return 'main_location';
    case 'phase1_contact': return 'main_contact';
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

/** Rótulos legíveis para UI (barra de progresso global). */
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
  main_document: 'CPF / CNPJ',
  main_avatar: 'Foto de perfil',
  main_extras_a: 'Bairro e bio',
  main_extras_b: 'Redes sociais',
  done: 'Concluído',
};
