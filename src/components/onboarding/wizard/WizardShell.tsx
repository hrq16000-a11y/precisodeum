/**
 * WizardShell — fachada única do onboarding (Fase A da fusão).
 *
 * Encapsula o handoff V3 (BetMode) → V2 (OnboardingV2) sob um único componente,
 * sem trocar de URL. O contrato anterior (`?source=bet-first-service`) deixa de
 * ser exposto na rota — o WizardShell sinaliza a transição internamente.
 *
 * Os steps continuam vivendo em `betMode/` e `onboardingV2/` durante a Fase A;
 * a Fase B moverá tudo para `wizard/steps/` e remover\u00e1 essas pastas.
 */
import { useState, useCallback } from 'react';
import BetModeShell from '@/components/onboarding/betMode/BetModeShell';
import OnboardingV2Shell from '@/components/onboarding/onboardingV2/OnboardingV2Shell';
import { appendWizardResetDebugLog } from '@/lib/wizardResetDebug';

type Stage = 'triage' | 'service-and-profile';

export default function WizardShell() {
  const [stage, setStage] = useState<Stage>('triage');

  // BetModeShell já dispara navigate('/onboarding-v2?source=bet-first-service')
  // ao concluir a triagem (provider). Interceptamos via query param sumiço:
  // como o WizardShell vive em /cadastro-inicial, a navegação não dispara —
  // por isso, expomos um hook de transição interno via window event.
  // (Compatibilidade: durante Fase A, os shells existentes ainda tentam
  // navegar; o gate em App.tsx redireciona /onboarding-v2 → /cadastro-inicial,
  // e o WizardShell remonta no stage correto baseado no profile do banco.)

  const handleTriageDone = useCallback(() => {
    appendWizardResetDebugLog({
      source: 'wizard-shell-handoff',
      route: '/cadastro-inicial',
      nextRoute: '/cadastro-inicial',
      phase: 'phase2_service',
      reason: 'internal-handoff-bet-to-v2',
      meta: { stage: 'service-and-profile' },
    });
    setStage('service-and-profile');
  }, []);

  if (stage === 'triage') {
    // BetModeShell aceita um callback opcional de handoff interno.
    return <BetModeShell onInternalHandoff={handleTriageDone} />;
  }

  return <OnboardingV2Shell />;
}
