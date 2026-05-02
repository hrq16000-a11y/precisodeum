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
  REVIEW_TOTAL_STEPS,
  UNIFIED_PHASE_LABELS,
  UNIFIED_VISIBLE_PHASES,
  unifiedPhaseIndex,
  type UnifiedPhase,
} from './wizardReducer';

interface WizardProgressBarProps {
  phase: UnifiedPhase;
  phaseOrder?: UnifiedPhase[];
  totalOverride?: number;
  /** Quando true, força 100% (usado em telas de celebração final). */
  forceComplete?: boolean;
}

export function WizardProgressBar({ phase, phaseOrder, totalOverride, forceComplete = false }: WizardProgressBarProps) {
  const activeOrder = phaseOrder && phaseOrder.length > 0 ? phaseOrder : undefined;
  const idx = activeOrder ? Math.max(0, activeOrder.indexOf(phase)) : unifiedPhaseIndex(phase);
  const derivedTotal = activeOrder ? Math.max(1, activeOrder.length - 1) : UNIFIED_VISIBLE_PHASES;
  const total = Math.max(1, totalOverride ?? derivedTotal);
  const rawStep = Math.min(idx + 1, total);
  const raw = (rawStep / total) * 100;
  const pct = forceComplete || phase === 'done' ? 100 : Math.min(100, Math.max(2, raw));
  const label = UNIFIED_PHASE_LABELS[phase] ?? '';
  const stepNumber = rawStep;

  return (
    <div
      className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Etapa ${stepNumber} de ${total} — ${label}`}
    >
      <div className="h-0.5 w-full bg-muted sm:h-1">
        <motion.div
          className="h-full bg-gradient-to-r from-accent to-primary"
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      </div>
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-0.5 text-[10px] text-muted-foreground sm:py-1.5 sm:text-[11px]">
        <span className="font-medium text-foreground">
          Etapa {stepNumber}/{total}
        </span>
        <span className="truncate pl-3">{label}</span>
      </div>
    </div>
  );
}

export default WizardProgressBar;
