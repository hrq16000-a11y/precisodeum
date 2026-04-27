/**
 * WizardShell — fachada única do onboarding (Fusão V3 + V2 — Fase B + Consolidação Fase 1).
 *
 * Encapsula o handoff Triagem (ex-V3) → Criação de Serviço & Perfil (ex-V2)
 * sob um único componente, sem trocar de URL. O contrato anterior baseado
 * em query string foi REMOVIDO — o stage agora é controlado 100%
 * internamente, em memória.
 *
 * Adições da Consolidação Fase 1:
 *  - <WizardProgressBar /> global no topo, baseado em UNIFIED_PHASE_ORDER.
 *  - Sub-shells reportam sua fase corrente via `onPhaseChange` para que o
 *    progresso global reflita o avanço real do funil completo.
 *
 * Steps vivem em `wizard/phases/bet/` (triagem) e `wizard/phases/v2/`
 * (serviço + perfil completo). A fusão profunda dos reducers e a planificação
 * das pastas acontecem na próxima fase da consolidação.
 */
import { useState, useCallback } from 'react';
import BetModeShell from '@/components/onboarding/wizard/phases/bet/BetModeShell';
import { OnboardingV2Shell } from '@/components/onboarding/wizard/phases/v2/OnboardingV2Shell';
import { appendWizardResetDebugLog } from '@/lib/wizardResetDebug';
import { WizardProgressBar } from './WizardProgressBar';
import {
  mapMainPhaseToUnified,
  mapTriagePhaseToUnified,
  type UnifiedPhase,
} from './wizardReducer';

type Stage = 'triage' | 'service-and-profile';

export default function WizardShell() {
  const [stage, setStage] = useState<Stage>('triage');
  const [unifiedPhase, setUnifiedPhase] = useState<UnifiedPhase>('triage_identity');

  const handleTriageDone = useCallback(() => {
    appendWizardResetDebugLog({
      source: 'wizard-shell-handoff',
      route: '/cadastro-inicial',
      nextRoute: '/cadastro-inicial',
      phase: 'phase2_service',
      reason: 'internal-handoff-triage-to-service',
      meta: { stage: 'service-and-profile' },
    });
    setStage('service-and-profile');
    setUnifiedPhase('main_action');
  }, []);

  const handleTriagePhaseChange = useCallback((betPhase: string) => {
    setUnifiedPhase(mapTriagePhaseToUnified(betPhase));
  }, []);

  const handleMainPhaseChange = useCallback((v2Phase: string) => {
    setUnifiedPhase(mapMainPhaseToUnified(v2Phase));
  }, []);

  return (
    <>
      <WizardProgressBar phase={unifiedPhase} />
      {stage === 'triage' ? (
        <BetModeShell
          onInternalHandoff={handleTriageDone}
          onPhaseChange={handleTriagePhaseChange}
        />
      ) : (
        <OnboardingV2Shell
          internalHandoffFromTriage
          onPhaseChange={handleMainPhaseChange}
        />
      )}
    </>
  );
}
