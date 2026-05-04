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
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Sparkles, Trophy } from 'lucide-react';
import DopamineCounter from '@/components/dashboard/DopamineCounter';
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
  points?: number;
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
  points,
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
  // A11y: respeita `prefers-reduced-motion` (sem motion + sem shimmer).
  // Performance: usa `transform: translateX` (composited, sem reflow) em
  // vez de animar a propriedade `x` via framer (que recalcula layout/repaint
  // a cada frame em barras finas). Mantido `motion` para o `width` por
  // continuidade visual com o spring.
  const prefersReducedMotion = useReducedMotion();
  const [shimmer, setShimmer] = useState(false);
  useEffect(() => {
    if (!anchored) return;
    if (prefersReducedMotion) return;
    setShimmer(true);
    const t = window.setTimeout(() => setShimmer(false), 240);
    return () => window.clearTimeout(t);
  }, [anchored, phase, prefersReducedMotion]);

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
      data-shimmer={shimmer || undefined}
    >
      <div className="relative h-0.5 w-full overflow-hidden bg-muted sm:h-1">
        <motion.div
          className={
            isMilestone
              ? 'h-full bg-gradient-to-r from-bet-amber via-bet-orange to-bet-green shadow-[0_0_8px_hsl(var(--bet-amber)/0.55)]'
              : 'h-full bg-gradient-to-r from-accent to-primary'
          }
          animate={{ width: `${pct}%` }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 120, damping: 22 }
          }
          style={{ willChange: 'width' }}
        />
        {shimmer && !prefersReducedMotion && (
          <span
            aria-hidden
            data-testid="wizard-progress-shimmer"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-bet-amber/35 to-transparent animate-wizard-shimmer"
            style={{ willChange: 'transform' }}
          />
        )}
      </div>
      <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-1 text-[10px] text-muted-foreground sm:py-1.5 sm:text-[11px]">
        {typeof points === 'number' && (
          <span
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-bet-amber/40 bg-gradient-to-br from-bet-amber-soft via-background to-bet-orange-soft px-3 py-2 font-bold text-foreground shadow-[0_0_24px_hsl(var(--bet-amber)/0.32)]"
            aria-label={`${Math.max(0, Math.trunc(points))} pontos`}
          >
            <Trophy className="h-4 w-4 text-bet-amber" aria-hidden strokeWidth={1.9} />
            <DopamineCounter
              value={Math.max(0, Math.trunc(points))}
              duration={700}
              suffix=" pts"
              celebrateOnComplete={false}
              className="text-base font-extrabold tabular-nums text-foreground"
            />
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1.5 font-medium text-foreground">
          {isMilestone && (
            <Sparkles
              className="h-3 w-3 text-bet-amber drop-shadow-[0_0_4px_hsl(var(--bet-amber)/0.6)]"
              aria-hidden
              strokeWidth={2}
            />
          )}
          Etapa {stepNumber}/{total}
        </span>
        <span className="min-w-0 flex-1 truncate pl-1 text-right">{label}</span>
      </div>
    </div>
  );
}

export default WizardProgressBar;
