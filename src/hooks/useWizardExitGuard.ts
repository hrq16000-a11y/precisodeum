/**
 * useWizardExitGuard — impede saída prematura do wizard.
 *
 * Regra dura: enquanto o usuário estiver entre `phase2_service` e
 * `phase2_photos` (1º serviço sendo criado), QUALQUER tentativa de sair
 * para `/dashboard` é bloqueada e redirecionada para a próxima fase
 * pendente. Também ativa `beforeunload` para refresh/fechar aba.
 *
 * Não interfere em fases avançadas (≥ phase3_celebration) — nessas, o
 * usuário já completou o "núcleo viciante" e pode visitar o dashboard.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from '@/lib/router-compat';
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';

const BLOCKED_DESTINATIONS = ['/dashboard'];

const PROTECTED_PHASES: OnboardingPhase[] = [
  'phase2_service',
  'phase2_details',
  'phase2_photos',
];

export function isWizardPhaseProtected(phase: OnboardingPhase | null | undefined): boolean {
  return !!phase && PROTECTED_PHASES.includes(phase);
}

/**
 * Próxima fase para onde o usuário deve ser empurrado se tentar sair.
 * Regra: se está em service/details → vai pra details/photos respectivamente.
 * Se já está em photos, fica em photos (não há "anterior" para forçá-lo).
 */
export function nextPhaseAfterBlock(phase: OnboardingPhase): OnboardingPhase {
  switch (phase) {
    case 'phase2_service': return 'phase2_details';
    case 'phase2_details': return 'phase2_photos';
    case 'phase2_photos': return 'phase2_photos';
    default: return phase;
  }
}

interface Options {
  phase: OnboardingPhase | null | undefined;
  /** Se true, ativa o guard. Permite desligar em modo edição/preview. */
  enabled?: boolean;
  /** Callback chamado quando o guard bloqueia uma navegação. */
  onBlocked?: (info: { from: OnboardingPhase; attemptedPath: string }) => void;
}

export function useWizardExitGuard({ phase, enabled = true, onBlocked }: Options) {
  const navigate = useNavigate();
  const location = useLocation();

  // 1) beforeunload: avisa o navegador antes de fechar/refresh.
  useEffect(() => {
    if (!enabled) return;
    if (!isWizardPhaseProtected(phase)) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Mensagem moderna (browser ignora string e mostra padrão dele).
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled, phase]);

  // 2) Roteamento: se a URL mudou para um destino bloqueado, devolve para
  //    /cadastro-inicial (rota canônica do wizard).
  useEffect(() => {
    if (!enabled) return;
    if (!isWizardPhaseProtected(phase)) return;
    const path = location.pathname;
    if (BLOCKED_DESTINATIONS.some((d) => path === d || path.startsWith(d + '/'))) {
      onBlocked?.({ from: phase as OnboardingPhase, attemptedPath: path });
      // eslint-disable-next-line no-console
      console.warn('[wizard-exit-guard] bloqueando saída para', path, '(fase:', phase, ')');
      navigate('/cadastro-inicial', { replace: true });
    }
  }, [enabled, phase, location.pathname, navigate, onBlocked]);
}
