/**
 * buildShellRenderState — coordinator PURO que reúne os builders já
 * existentes (chrome, modais, visual state) em um único snapshot imutável
 * consumido pelo tail JSX do OnboardingV2Shell.
 *
 * Não introduz lógica nova: delega para `buildShellChromeProps`,
 * `buildRemoteDraftSnapshot`, `buildErrorContextSnapshot` e
 * `buildPhaseVisualState`. O shell troca 4 chamadas + 4 variáveis locais
 * por 1 chamada e 1 referência (`render.chromeProps`, `render.remote`, …).
 *
 * Sem hooks, sem refs, sem effects, sem dispatch, sem fetch. Todos os
 * callbacks de runtime continuam montados no shell e são passados
 * verbatim a `OnboardingShellModals`.
 *
 * PR 15 — Final Shell Density Pass (UI-only).
 */
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';
import type { OnboardingViewModel } from '@/hooks/onboarding/useOnboardingViewModel';
import { buildShellChromeProps, type ShellChromeProps } from './buildShellChromeProps';
import {
  buildErrorContextSnapshot,
  buildRemoteDraftSnapshot,
  type ErrorContextSnapshot,
  type RemoteDraftSnapshot,
} from './buildShellModalProps';
import { buildPhaseVisualState, type PhaseVisualState } from './buildPhaseVisualState';

interface ShellRenderStateInput {
  phase: OnboardingPhase;
  viewModel: OnboardingViewModel;
  draftRestored: { source: 'local' | 'remote'; at?: string } | null;
  autoSaveSignal: unknown;
  remoteDraft: { payload?: unknown | null; phase?: string | null; updated_at?: string | null } | null | undefined;
  errorState: {
    service?: { category_ids?: string[] | null } | null;
    profile?: { city?: string | null; state?: string | null } | null;
  };
  lastPersistError: { message: string; code?: string | null } | null | undefined;
}

export interface ShellRenderState {
  readonly visual: PhaseVisualState;
  readonly chromeProps: ShellChromeProps;
  readonly remoteSnapshot: RemoteDraftSnapshot;
  readonly errorContextSnapshot: ErrorContextSnapshot;
}

export const buildShellRenderState = ({
  phase,
  viewModel,
  draftRestored,
  autoSaveSignal,
  remoteDraft,
  errorState,
  lastPersistError,
}: ShellRenderStateInput): ShellRenderState => {
  const visual = buildPhaseVisualState(phase, viewModel);
  return {
    visual,
    chromeProps: buildShellChromeProps({
      draftRestored,
      showAutoSaveBadge: visual.showAutoSaveBadge,
      autoSaveSignal,
      phase,
    }),
    remoteSnapshot: buildRemoteDraftSnapshot(remoteDraft),
    errorContextSnapshot: buildErrorContextSnapshot(errorState, lastPersistError),
  };
};

export default buildShellRenderState;
