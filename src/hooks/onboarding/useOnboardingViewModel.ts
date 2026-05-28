/**
 * useOnboardingViewModel — derivações puramente VISUAIS do OnboardingV2Shell.
 *
 * Camada de composição (PR 9 — UI Composition Pass; expandida em PR 10/11).
 * Não toca runtime:
 *   ❌ não persiste, não hidrata, não fetch, não despacha reducer,
 *      não toca localStorage, cross-tab, lifecycle, refs ou writes.
 *   ✅ apenas memoiza booleans/derivações que o JSX consome.
 *
 * Adicione aqui novas flags derivadas para evitar recálculo inline no shell.
 */
import { useMemo } from 'react';
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';

interface OnboardingViewModelInput {
  phase: OnboardingPhase;
}

export interface OnboardingViewModel {
  /** Verdadeiro a partir da celebração (inclusive) — usado para barras/copy. */
  isCelebrationOrLater: boolean;
  /** Quando exibir o badge de autosave no topo do card. */
  showAutoSaveBadge: boolean;
  /** Fase terminal — o shell pode pular renderizações específicas. */
  isTerminal: boolean;
  /** Fase auxiliar de reparo de contato (fora do PHASE_ORDER principal). */
  isRepairPhase: boolean;
  /** Fase está coberta pelo router declarativo `phaseComponentMap`. */
  isMigratedPhase: boolean;
  /** Mostra o bloco `<WizardEncouragement>` por baixo do conteúdo principal. */
  showEncouragement: boolean;
  /** Mostra o banner de "rascunho restaurado". */
  showDraftBanner: boolean;
  /** Mostra CTAs/avisos terminais (apenas em `done`). */
  showTerminalActions: boolean;
  /** Fluxo de mídia do 1º serviço (fotos do serviço). */
  isMediaFlow: boolean;
  /** Fluxo de completar perfil pós-celebração (doc + avatar + extras). */
  isProfileCompletionFlow: boolean;
  /** PR 12 — chrome de progresso (barras/badges) deve aparecer? */
  showProgressChrome: boolean;
  /** PR 12 — chrome de conclusão (cards terminais) deve aparecer? */
  showCompletionChrome: boolean;
  /** PR 12 — alias semântico de `isTerminal` para consumidores visuais. */
  isTerminalPhase: boolean;
  /** PR 12 — fase usa layout compacto (sem padding/header pesado do shell). */
  usesCompactLayout: boolean;
}

const CELEBRATION_OR_LATER = new Set<OnboardingPhase>([
  'phase3_celebration',
  'phase4_document',
  'phase4_avatar',
  'phase4_extras_a',
  'phase4_extras_b',
  'done',
]);

const MIGRATED_PHASES = new Set<OnboardingPhase>([
  'phase2_service',
  'phase2_details',
  'phase2_photos',
  'phase4_document',
  'phase4_avatar',
  'phase4_extras_a',
  'phase4_extras_b',
]);

const ENCOURAGEMENT_PHASES = new Set<OnboardingPhase>([
  'phase2_service',
  'phase2_details',
  'phase2_photos',
]);

const MEDIA_FLOW_PHASES = new Set<OnboardingPhase>([
  'phase2_photos',
]);

const PROFILE_COMPLETION_PHASES = new Set<OnboardingPhase>([
  'phase4_document',
  'phase4_avatar',
  'phase4_extras_a',
  'phase4_extras_b',
]);

export function useOnboardingViewModel({ phase }: OnboardingViewModelInput): OnboardingViewModel {
  return useMemo(
    () => ({
      isCelebrationOrLater: CELEBRATION_OR_LATER.has(phase),
      // Mantém o contrato visual original do shell: o badge só some na 1ª
      // fase (`phase2_service`) e na tela terminal (`done`).
      showAutoSaveBadge: phase !== 'phase2_service' && phase !== 'done',
      isTerminal: phase === 'done',
      isRepairPhase: phase === 'phase_repair_contact',
      isMigratedPhase: MIGRATED_PHASES.has(phase),
      showEncouragement: ENCOURAGEMENT_PHASES.has(phase),
      // Banner de rascunho restaurado só faz sentido antes da celebração e
      // fora da fase auxiliar de reparo.
      showDraftBanner:
        !CELEBRATION_OR_LATER.has(phase) && phase !== 'phase_repair_contact' && phase !== 'done',
      showTerminalActions: phase === 'done',
      isMediaFlow: MEDIA_FLOW_PHASES.has(phase),
      isProfileCompletionFlow: PROFILE_COMPLETION_PHASES.has(phase),
    }),
    [phase],
  );
}
