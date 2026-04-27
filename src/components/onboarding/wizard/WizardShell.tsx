/**
 * WizardShell — fachada única do onboarding (Fusão V3 + V2 — Fase B).
 *
 * Encapsula o handoff Triagem (ex-V3) → Criação de Serviço & Perfil (ex-V2)
 * sob um único componente, sem trocar de URL. O contrato anterior baseado em
 * `?source=bet-first-service` foi REMOVIDO — o stage agora é controlado 100%
 * internamente, em memória.
 *
 * Steps vivem em `wizard/phases/bet/` (triagem) e `wizard/phases/v2/`
 * (serviço + perfil completo).
 */
import { useState, useCallback } from 'react';
import BetModeShell from '@/components/onboarding/wizard/phases/bet/BetModeShell';
import { OnboardingV2Shell } from '@/components/onboarding/wizard/phases/v2/OnboardingV2Shell';
import { appendWizardResetDebugLog } from '@/lib/wizardResetDebug';

type Stage = 'triage' | 'service-and-profile';

export default function WizardShell() {
  const [stage, setStage] = useState<Stage>('triage');

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
  }, []);

  if (stage === 'triage') {
    return <BetModeShell onInternalHandoff={handleTriageDone} />;
  }

  return <OnboardingV2Shell internalHandoffFromTriage />;
}
