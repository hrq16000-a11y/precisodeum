/**
 * WizardProgressBar — barra de progresso global do onboarding unificado.
 *
 * Usa `UNIFIED_PHASE_ORDER` como fonte de verdade do total de fases e
 * calcula a porcentagem de conclusão a partir da fase atual.
 *
 * Vive no topo do WizardShell e é o ÚNICO indicador de progresso do
 * funil completo (triagem + serviço + perfil).
 *
 * Adições:
 *  - `milestone`: aplica selo dourado (Lucide Sparkles) e leve glow âmbar
 *    quando a fase atual é marco (`isReviewMilestonePhase`).
 *  - `anchored`: dispara um shimmer rápido (200ms) na barra quando o HUD
 *    está ancorado em fase renderável anterior — sinaliza ao usuário que
 *    "algo aconteceu" sem confundir com avanço real do progresso.
 */
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  UNIFIED_PHASE_LABELS,
  UNIFIED_VISIBLE_PHASES,
  unifiedPhaseIndex,
  type UnifiedPhase,
} from './wizardReducer';
// Fonte ÚNICA do total de passos da régua de revisão. NÃO redeclarar
// localmente — qualquer divergência aqui dessincroniza HUD vs Dashboard.
import { REVIEW_TOTAL_STEPS, isReviewMilestonePhase } from './wizardReviewSteps';
import { resolveUnifiedPhaseLabel } from './useReviewAnchor';

interface WizardProgressBarProps {
  phase: UnifiedPhase;
  phaseOrder?: UnifiedPhase[];
  totalOverride?: number;
  /** Quando true, força 100% (usado em telas de celebração final). */
  forceComplete?: boolean;
  /** Quando true, sinaliza que o numerador exibido é uma âncora (fase atual
   *  é fantasma). Aplica shimmer breve na barra para indicar atividade. */
  anchored?: boolean;
}

export function WizardProgressBar({
  phase,
  phaseOrder,
  totalOverride,
  forceComplete = false,
  anchored = false,
}: WizardProgressBarProps) {
  const activeOrder = phaseOrder && phaseOrder.length > 0 ? phaseOrder : undefined;
  const idx = activeOrder ? Math.max(0, activeOrder.indexOf(phase)) : unifiedPhaseIndex(phase);
  const derivedTotal = activeOrder ? Math.max(1, activeOrder.length - 1) : UNIFIED_VISIBLE_PHASES;
  const total = Math.max(1, totalOverride ?? derivedTotal);
  const rawStep = Math.min(idx + 1, total);
  const raw = (rawStep / total) * 100;
  const pct = forceComplete || phase === 'done' ? 100 : Math.min(100, Math.max(2, raw));
  // Invariante UX: barra nunca mostra label vazio (fase desconhecida cai
  // em "Etapa em revisão"). Mantém paridade com o HUD do WizardShell.
  const label = resolveUnifiedPhaseLabel(UNIFIED_PHASE_LABELS, phase);
  const stepNumber = rawStep;
  const isMilestone = isReviewMilestonePhase(phase);
  // `REVIEW_TOTAL_STEPS` é referenciado para travar o import (fonte única);
  // o valor efetivo do total já chega via `totalOverride` do WizardShell.
  void REVIEW_TOTAL_STEPS;

  // Shimmer one-shot quando entra em modo "anchored". Limpa em 220ms para
  // não interferir com a animação de spring do width.
  const [shimmer, setShimmer] = useState(false);
  useEffect(() => {
    if (!anchored) return;
    setShimmer(true);
    const t = window.setTimeout(() => setShimmer(false), 220);
    return () => window.clearTimeout(t);
  }, [anchored, phase]);

  return (
    <div
      className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Etapa ${stepNumber} de ${total} — ${label}`}
      data-milestone={isMilestone || undefined}
      data-anchored={anchored || undefined}
    >
      <div className="relative h-0.5 w-full bg-muted sm:h-1">
        <motion.div
          className={
            isMilestone
              ? 'h-full bg-gradient-to-r from-bet-amber via-bet-orange to-bet-green shadow-[0_0_8px_hsl(var(--bet-amber)/0.55)]'
              : 'h-full bg-gradient-to-r from-accent to-primary'
          }
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
        {shimmer && (
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-transparent via-bet-amber/35 to-transparent"
            initial={{ x: '-30%', opacity: 0 }}
            animate={{ x: '130%', opacity: [0, 1, 0] }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          />
        )}
      </div>
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-0.5 text-[10px] text-muted-foreground sm:py-1.5 sm:text-[11px]">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          {isMilestone && (
            <Sparkles
              className="h-3 w-3 text-bet-amber drop-shadow-[0_0_4px_hsl(var(--bet-amber)/0.6)]"
              aria-hidden
              strokeWidth={2}
            />
          )}
          Etapa {stepNumber}/{total}
        </span>
        <span className="truncate pl-3">{label}</span>
      </div>
    </div>
  );
}

export default WizardProgressBar;
