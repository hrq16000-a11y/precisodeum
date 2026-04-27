/**
 * WizardProgressBar — barra de progresso global do onboarding unificado.
 *
 * Usa `UNIFIED_PHASE_ORDER` como fonte de verdade do total de fases e
 * calcula a porcentagem de conclusão a partir da fase atual.
 *
 * Vive no topo do WizardShell e é o ÚNICO indicador de progresso do
 * funil completo (triagem + serviço + perfil).
 */
import { motion } from 'framer-motion';
import {
  UNIFIED_PHASE_LABELS,
  UNIFIED_VISIBLE_PHASES,
  unifiedPhaseIndex,
  type UnifiedPhase,
} from './wizardReducer';

interface WizardProgressBarProps {
  phase: UnifiedPhase;
  /** Quando true, força 100% (usado em telas de celebração final). */
  forceComplete?: boolean;
}

export function WizardProgressBar({ phase, forceComplete = false }: WizardProgressBarProps) {
  const idx = unifiedPhaseIndex(phase);
  const raw = ((idx + 1) / UNIFIED_VISIBLE_PHASES) * 100;
  const pct = forceComplete || phase === 'done' ? 100 : Math.min(100, Math.max(2, raw));
  const label = UNIFIED_PHASE_LABELS[phase] ?? '';
  const stepNumber = Math.min(idx + 1, UNIFIED_VISIBLE_PHASES);

  return (
    <div
      className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Etapa ${stepNumber} de ${UNIFIED_VISIBLE_PHASES} — ${label}`}
    >
      <div className="h-1 w-full bg-muted">
        <motion.div
          className="h-full bg-gradient-to-r from-accent to-primary"
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      </div>
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-1.5 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">
          Etapa {stepNumber} de {UNIFIED_VISIBLE_PHASES}
        </span>
        <span className="truncate pl-3">{label}</span>
      </div>
    </div>
  );
}

export default WizardProgressBar;
