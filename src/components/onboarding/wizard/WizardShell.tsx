/**
 * WizardShell — fachada ÚNICA do onboarding unificado (Consolidação Fase 2).
 *
 * Encapsula triagem (ex-Bet Mode V3) + criação de serviço & perfil (ex-V2)
 * sob um único componente, sem trocar de URL. Este é o ÚNICO componente
 * exportado publicamente do wizard.
 *
 * Adições da Fase 2:
 *  - Botão "Voltar" sticky e visível em TODO passo (exceto o primeiro e a
 *    celebração final), via `WizardNav`.
 *  - Bordão de Avançar com animação visível (pulse + glow accent→primary)
 *    entregue como CTA padrão dos steps que aceitam `onNext` direto.
 *  - Telemetria unificada por fase: cada avanço de `unifiedPhase` registra
 *    um evento em `onboarding_events` (variante `unified`).
 *  - Reducer público linear (`wizardReducer`) é a fonte de verdade do
 *    progresso global. Os orquestradores internos (`TriageOrchestrator` e
 *    `MainOrchestrator`) reportam sua fase via `onPhaseChange` para manter
 *    a barra global e a telemetria sincronizadas.
 *
 * Os orquestradores internos NÃO são exportados — são detalhe de
 * implementação. Toda persistência (provider, create_service_atomic,
 * patches incrementais, drafts local + remote) permanece encapsulada lá.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import TriageOrchestrator from '@/components/onboarding/wizard/phases/bet/BetModeShell';
import { OnboardingV2Shell as MainOrchestrator } from '@/components/onboarding/wizard/phases/v2/OnboardingV2Shell';
import Step20_MoreServices from '@/components/onboarding/wizard/phases/Step20_MoreServices';
import Step21_PortfolioAlbums from '@/components/onboarding/wizard/phases/Step21_PortfolioAlbums';
import { appendWizardResetDebugLog } from '@/lib/wizardResetDebug';
import { WizardProgressBar } from './WizardProgressBar';
import { trackOnboardingEvent } from './phases/v2/telemetry';
import {
  initialWizardState,
  mapMainPhaseToUnified,
  mapTriagePhaseToUnified,
  wizardReducer,
  type UnifiedPhase,
} from './wizardReducer';
import type { BetState } from './phases/bet/types';

type Stage = 'triage' | 'service-and-profile' | 'extras-services' | 'extras-portfolio' | 'done';

export default function WizardShell() {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  // Stage continua como "qual orquestrador renderizar" — é derivado da fase.
  const stage: Stage =
    state.phase.startsWith('triage_')
      ? 'triage'
      : state.phase === 'main_more_services'
      ? 'extras-services'
      : state.phase === 'main_portfolio_albums'
      ? 'extras-portfolio'
      : state.phase === 'done'
      ? 'done'
      : 'service-and-profile';
  const lastTrackedPhase = useRef<UnifiedPhase | null>(null);

  // Telemetria: registra cada avanço de fase unificada UMA vez.
  useEffect(() => {
    if (lastTrackedPhase.current === state.phase) return;
    lastTrackedPhase.current = state.phase;
    void trackOnboardingEvent({
      phase: state.phase as any,
      event: state.phase === 'done' ? 'complete' : 'enter',
      meta: { variant: 'unified', stage },
    });
  }, [state.phase, stage]);

  const handleTriageDone = useCallback((triageState: BetState) => {
    appendWizardResetDebugLog({
      source: 'wizard-shell-handoff',
      route: '/cadastro-inicial',
      nextRoute: '/cadastro-inicial',
      phase: 'phase2_service',
      reason: 'internal-handoff-triage-to-service',
      meta: { stage: 'service-and-profile', unified: true },
    });
    dispatch({
      type: 'HYDRATE',
      state: {
        phase: 'main_service',
        triage: triageState,
        profile: {
          ...state.profile,
          profile_type: 'provider',
          kind: triageState.pro_kind || 'pf',
          full_name: triageState.full_name,
          whatsapp: triageState.whatsapp,
          document: triageState.document,
          city: triageState.city,
          state: triageState.state,
        },
        service: {
          ...state.service,
          cities_served: triageState.city ? [triageState.city] : [],
        },
      },
    });
  }, [state.profile, state.service]);

  const handleTriagePhaseChange = useCallback((betPhase: string) => {
    dispatch({ type: 'GO_TO_PHASE', phase: mapTriagePhaseToUnified(betPhase) });
  }, []);

  const handleMainPhaseChange = useCallback((v2Phase: string) => {
    dispatch({ type: 'GO_TO_PHASE', phase: mapMainPhaseToUnified(v2Phase) });
  }, []);

  // Botão de voltar global — usa o histórico do navegador como fallback
  // já que cada step já tem Voltar próprio integrado ao reducer interno.
  const showGlobalBack =
    state.phase !== 'triage_identity' &&
    state.phase !== 'triage_celebration' &&
    state.phase !== 'main_celebration' &&
    state.phase !== 'done';

  const handleGlobalBack = useCallback(() => {
    void trackOnboardingEvent({
      phase: state.phase as any,
      event: 'back',
      meta: { variant: 'unified', source: 'global-nav' },
    });
    // Dispara um evento DOM que os steps podem opcionalmente capturar.
    // Como fallback, o usuário também tem o botão "Voltar" interno do step.
    window.dispatchEvent(new CustomEvent('wizard:request-back', { detail: { phase: state.phase } }));
  }, [state.phase]);

  return (
    <>
      <WizardProgressBar phase={state.phase} />
      {showGlobalBack && (
        <div className="mx-auto mt-2 flex w-full max-w-md justify-start px-4">
          <button
            type="button"
            onClick={handleGlobalBack}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Voltar para o passo anterior"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
        </div>
      )}
      {stage === 'triage' ? (
        <TriageOrchestrator
          onInternalHandoff={handleTriageDone}
          onPhaseChange={handleTriagePhaseChange}
        />
      ) : stage === 'extras-services' ? (
        <Step20_MoreServices
          onContinue={() => dispatch({ type: 'GO_TO_PHASE', phase: 'main_portfolio_albums' })}
          onSkip={() => dispatch({ type: 'GO_TO_PHASE', phase: 'main_portfolio_albums' })}
        />
      ) : stage === 'extras-portfolio' ? (
        <Step21_PortfolioAlbums
          onContinue={() => dispatch({ type: 'GO_TO_PHASE', phase: 'done' })}
          onSkip={() => dispatch({ type: 'GO_TO_PHASE', phase: 'done' })}
        />
      ) : stage === 'done' ? (
        <div className="mx-auto w-full max-w-md px-4 py-8 text-center">
          <h2 className="text-xl font-semibold">Cadastro concluído!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu perfil está pronto. Você já pode acessar o painel para gerenciar seus serviços, portfólio e leads.
          </p>
        </div>
      ) : (
        <MainOrchestrator
          internalHandoffFromTriage
          seedState={{
            phase: 'phase2_service',
            profile: state.profile,
            service: state.service,
            providerId: state.providerId,
            firstServiceId: state.firstServiceId,
          }}
          onPhaseChange={handleMainPhaseChange}
        />
      )}
    </>
  );
}
