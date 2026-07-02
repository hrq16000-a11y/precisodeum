/**
 * wizardReviewSteps — FONTE ÚNICA da régua de revisão (X/19).
 *
 * Antes deste arquivo, a ordem das fases de revisão vivia em DOIS lugares:
 *   1. `REVIEW_PHASE_ORDER` em `wizardReducer.ts` (consumida pelo HUD/Wizard).
 *   2. `PHASE_CATALOG` em `pages/DashboardAssistantPage.tsx` (cards do Dashboard).
 *
 * Qualquer divergência entre eles passava silenciosa e causava o numerador
 * "X/19" do HUD a desincronizar dos cards do Assistente. Este módulo
 * centraliza o catálogo: `REVIEW_PHASE_ORDER`, `REVIEW_TOTAL_STEPS`,
 * helpers de navegação e o `PHASE_CATALOG` (com label/section) são todos
 * derivados desta lista.
 *
 * Regra de evolução: SE você adicionar/remover uma fase de revisão, mexa
 * APENAS aqui. O reducer re-exporta as constantes; o Dashboard consome
 * o catálogo direto.
 */

import type { UnifiedPhase } from './wizardReducer';
import type { OnboardingReviewSection } from '@/lib/onboardingAccess';

/** Metadados completos de uma fase na régua de revisão. */
export type ReviewStepMeta = {
  phase: UnifiedPhase;
  /** Rótulo curto exibido no card do Assistente. */
  title: string;
  /** Descrição auxiliar. */
  description: string;
  /** Seção do wizard a abrir em modo review. `null` = somente leitura. */
  section: OnboardingReviewSection | null;
  /** Marcos visuais (celebrações). Não contam no numerador X/19 nem no HUD. */
  milestone?: boolean;
  /**
   * Fases mantidas na régua APENAS por compat numérica com versões antigas
   * do Assistente. A navegação real do Wizard as pula automaticamente
   * (`isReviewPhaseRenderable === false`).
   */
  nonRenderable?: boolean;
};

/**
 * CATÁLOGO CANÔNICO — a ordem aqui É a régua oficial X/19.
 * Mantém paridade 1:1 com cards do `/dashboard/assistente` e com o numerador
 * exibido pelo `WizardProgressBar`/`PointsHud`.
 */
export const REVIEW_STEP_CATALOG: ReviewStepMeta[] = [
  { phase: 'triage_identity',       title: 'Identidade',                 description: 'Foto, nome e WhatsApp.',                              section: 'cadastro' },
  { phase: 'triage_who',            title: 'Tipo de uso',                description: 'Cliente, profissional, empresa ou RH.',               section: 'cadastro' },
  { phase: 'triage_pro_kind',       title: 'Tipo de profissional',       description: 'Autônomo ou empresa.',                                section: 'cadastro' },
  { phase: 'triage_pro_document',   title: 'Documento (CPF/CNPJ)',       description: 'Opcional — concede selo verificado.',                  section: 'dados' },
  { phase: 'triage_pro_location',   title: 'Cidade-base e bairro',       description: 'Onde sua empresa atende.',                            section: 'cadastro' },
  { phase: 'triage_celebration',    title: 'Conta criada',               description: 'Marco de conclusão da triagem inicial.',              section: null, milestone: true },

  { phase: 'main_action',           title: 'Próxima ação',               description: 'O que você quer fazer agora.',                        section: null,        nonRenderable: true },
  { phase: 'main_kind',             title: 'Tipo de conta',              description: 'Pessoa Física ou Jurídica.',                          section: 'cadastro',  nonRenderable: true },
  { phase: 'main_location',         title: 'Localização do perfil',      description: 'Cidade e estado base do seu perfil.',                 section: 'cadastro',  nonRenderable: true },
  { phase: 'main_contact',          title: 'Contato',                    description: 'Nome completo e WhatsApp principal.',                 section: 'cadastro',  nonRenderable: true },

  { phase: 'main_service',          title: '1º serviço — categoria',     description: 'Qual categoria descreve seu trabalho.',               section: 'servicos' },
  { phase: 'main_service_details',  title: '1º serviço — detalhes',      description: 'Nome, descrição e cidades atendidas.',                section: 'servicos' },
  { phase: 'main_photos',           title: 'Fotos do serviço',           description: 'Fotos que valorizam seu trabalho (opcional).',        section: 'portfolio' },
  { phase: 'main_celebration',      title: 'Serviço publicado',          description: 'Marco de publicação do primeiro serviço.',            section: null, milestone: true },

  { phase: 'main_document',         title: 'Documentos do perfil',       description: 'CPF/CNPJ e dados fiscais (opcional).',                section: 'dados' },
  { phase: 'main_avatar',           title: 'Avatar',                     description: 'Sua foto de perfil pública.',                         section: 'cadastro' },
  { phase: 'main_extras_a',         title: 'Bairro e bio',               description: 'Bairro de atuação e mini-currículo.',                 section: 'cadastro' },
  { phase: 'main_extras_b',         title: 'Redes sociais',              description: 'Instagram, site, etc. (opcional).',                   section: 'url' },

  { phase: 'main_more_services',    title: 'Mais serviços',              description: 'Adicione novos serviços ao seu perfil.',              section: 'servicos' },
  { phase: 'main_portfolio_albums', title: 'Álbuns de portfólio',        description: 'Organize fotos por trabalho.',                        section: 'portfolio' },
];

/** Ordem canônica das fases de revisão (X/19) + 'done' como sentinela. */
export const REVIEW_PHASE_ORDER: UnifiedPhase[] = [
  ...REVIEW_STEP_CATALOG.map((m) => m.phase),
  'done',
];

/**
 * Total exibido pelo HUD/Assistente (numerador X/N).
 *
 * Valor canônico = 19. Mantemos esta constante como CONSTANTE EXPLÍCITA
 * (não derivada de `catalog.length`) porque a régua exibida ao usuário
 * agrupa visualmente os dois últimos passos e inclui marcos de
 * celebração na contagem — qualquer fórmula derivada teria que reaplicar
 * esses ajustes e tornaria o número frágil.
 *
 * O teste de fonte única (`wizard-review-steps-source-of-truth.test.ts`)
 * trava a paridade entre WizardProgressBar e DashboardAssistantPage:
 * ambos consomem ESTA constante, eliminando a duplicação histórica.
 */
export const REVIEW_TOTAL_STEPS = 19;

/** Set de fases não-renderizáveis (mantidas só para paridade histórica). */
const NON_RENDERABLE_REVIEW_PHASES: ReadonlySet<UnifiedPhase> = new Set(
  REVIEW_STEP_CATALOG.filter((m) => m.nonRenderable).map((m) => m.phase),
);

export function isReviewPhaseRenderable(phase: UnifiedPhase): boolean {
  return !NON_RENDERABLE_REVIEW_PHASES.has(phase);
}

export function nextRenderableReviewPhase(phase: UnifiedPhase): UnifiedPhase {
  const i = REVIEW_PHASE_ORDER.indexOf(phase);
  if (i < 0) return phase;
  for (let k = i + 1; k < REVIEW_PHASE_ORDER.length; k++) {
    const candidate = REVIEW_PHASE_ORDER[k];
    if (isReviewPhaseRenderable(candidate)) return candidate;
  }
  return phase;
}

export function prevRenderableReviewPhase(phase: UnifiedPhase): UnifiedPhase {
  const i = REVIEW_PHASE_ORDER.indexOf(phase);
  if (i <= 0) return phase;
  for (let k = i - 1; k >= 0; k--) {
    const candidate = REVIEW_PHASE_ORDER[k];
    if (isReviewPhaseRenderable(candidate)) return candidate;
  }
  return phase;
}

/** Set de fases-marco (celebrações). Não somam no numerador X/19, mas
 *  recebem destaque visual (selo dourado) no ProgressBar e no Assistente. */
const MILESTONE_REVIEW_PHASES: ReadonlySet<UnifiedPhase> = new Set(
  REVIEW_STEP_CATALOG.filter((m) => m.milestone).map((m) => m.phase),
);

export function isReviewMilestonePhase(phase: UnifiedPhase): boolean {
  return MILESTONE_REVIEW_PHASES.has(phase);
}

