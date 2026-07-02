/**
 * useWizardSkipListener — ouvinte global do botão "Pular esta etapa"
 * exibido pelo WizardShell em modo `edit_profile`.
 *
 * PR 17 — Shell Surface Slimming (telemetry/lifecycle helpers).
 * EXTRAÍDO 1:1 do `OnboardingV2Shell` sem alterar semântica:
 *   - Mesma idempotência (sem deps no useEffect — listener registrado 1×).
 *   - Mesmo cleanup (`removeEventListener`).
 *   - Mesma carga: dispara `dispatch({ type: 'NEXT' })`.
 *
 * Não toca runtime: o `dispatch` recebido continua sob ownership do shell
 * (mesmo reducer, mesmo estado, mesmas dependências).
 */
import { useEffect } from 'react';

type SkipDispatcher = (action: { type: 'NEXT' }) => void;

export function useWizardSkipListener(dispatch: SkipDispatcher): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSkip = () => {
      dispatch({ type: 'NEXT' });
    };
    window.addEventListener('wizard:request-skip', handleSkip as EventListener);
    return () => {
      window.removeEventListener('wizard:request-skip', handleSkip as EventListener);
    };
    // Intencionalmente sem `dispatch` no array — dispatch do useReducer é
    // estável e o listener deve ser registrado UMA única vez (preserva a
    // semântica original do shell que usava `[]`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default useWizardSkipListener;
