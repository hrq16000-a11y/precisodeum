/**
 * EditModeSkipButton — atalho explícito para pular uma fase quando o
 * usuário está em modo `edit_profile` (R7 da auditoria) e a fase já tem
 * todos os campos obrigatórios salvos no banco.
 *
 * Implementação cirúrgica: NÃO altera as fases internas do wizard. Em vez
 * disso, dispara um evento DOM (`wizard:request-skip`) que o orquestrador
 * de turno já escuta — o mesmo padrão usado pelo botão "Voltar" global.
 *
 * UX:
 *  - Renderiza apenas se `mode === 'edit_profile'` E a fase atual está
 *    100% preenchida (via `isPhaseFullyCompleted`).
 *  - Visual discreto (variant outline + ícone Lucide ChevronsRight) — não
 *    compete com o CTA principal.
 *  - Sem emojis (constraint global).
 */
import { useCallback } from 'react';
import { ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackOnboardingEvent } from './phases/v2/telemetry';
import { useWizardMode, isPhaseFullyCompleted } from './wizardMode';
import type { WizardState, UnifiedPhase } from './wizardReducer';

interface Props {
  state: WizardState;
  phase: UnifiedPhase;
}

export default function EditModeSkipButton({ state, phase }: Props) {
  const { mode, isEditing } = useWizardMode();

  const handleSkip = useCallback(() => {
    void trackOnboardingEvent({
      phase: phase as any,
      event: 'skip',
      meta: {
        variant: 'unified',
        mode,
        reason: 'data_already_exists',
        source: 'edit-mode-skip-button',
      },
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('wizard:request-skip', { detail: { phase, mode } }),
      );
    }
  }, [mode, phase]);

  if (!isEditing) return null;
  if (!isPhaseFullyCompleted(state, phase)) return null;

  return (
    <div className="sticky top-16 z-20 mx-auto flex w-full max-w-5xl justify-end px-4 pt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSkip}
        className="gap-2 border-dashed text-muted-foreground hover:text-primary"
        aria-label="Pular esta etapa porque os dados já existem"
        title="Os dados desta etapa já estão salvos. Você pode pular para a próxima."
      >
        Pular esta etapa
        <ChevronsRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
