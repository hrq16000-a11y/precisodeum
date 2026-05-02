/**
 * useReviewAnchor — hook que encapsula a "âncora de revisão".
 *
 * PROBLEMA: em modo revisão (`isReview=true`), o usuário pode aterrissar em
 * fases marcadas como `nonRenderable` no `REVIEW_STEP_CATALOG` (ex.:
 * `main_action`, `main_kind`, `main_location`, `main_contact` — expurgadas
 * mas mantidas na régua para paridade histórica). Quando isso acontece,
 * `REVIEW_PHASE_ORDER.indexOf(phase)` retorna -1 e o numerador do HUD
 * "X/19" saltaria para 1 ou ficaria vazio.
 *
 * SOLUÇÃO: ancoramos a UI na ÚLTIMA fase renderável visitada. Enquanto o
 * Wizard atravessa fases-fantasma, o HUD mantém o último numerador válido,
 * sem saltos visuais. Este hook é a fonte ÚNICA dessa lógica e é
 * compartilhado entre WizardShell, WizardProgressBar e qualquer outro
 * componente que precise renderizar o passo atual em modo revisão.
 *
 * Telemetria: emite `review_anchor_used` (uma vez por travessia de
 * fase-fantasma) para auditoria de UX. Casos legítimos são raros — picos
 * desse evento indicam regressão de roteamento que merece investigação.
 */
import { useEffect, useRef } from 'react';
import {
  REVIEW_PHASE_ORDER,
  isReviewPhaseRenderable,
  type UnifiedPhase,
} from './wizardReducer';
import { trackOnboardingEvent } from './phases/v2/telemetry';

export interface ReviewAnchorState {
  /** Fase efetiva a ser usada por HUD/ProgressBar. Nunca fantasma quando há
   *  ao menos uma fase renderável já visitada. */
  anchorPhase: UnifiedPhase;
  /** True quando a fase atual é fantasma e o anchor difere dela. */
  isAnchored: boolean;
  /** Índice da `anchorPhase` em `REVIEW_PHASE_ORDER` (≥ 0). */
  anchorIndex: number;
}

export function useReviewAnchor(phase: UnifiedPhase, isReview: boolean): ReviewAnchorState {
  const lastRenderableRef = useRef<UnifiedPhase | null>(null);
  const lastTrackedAnchorRef = useRef<UnifiedPhase | null>(null);

  // Atualiza o "último renderável" durante o render — barato e idempotente.
  if (isReview && REVIEW_PHASE_ORDER.indexOf(phase) >= 0 && isReviewPhaseRenderable(phase)) {
    lastRenderableRef.current = phase;
  }

  const phaseInOrder = REVIEW_PHASE_ORDER.indexOf(phase) >= 0 && isReviewPhaseRenderable(phase);
  const shouldAnchor = isReview && !phaseInOrder && Boolean(lastRenderableRef.current);
  const anchorPhase: UnifiedPhase = shouldAnchor
    ? (lastRenderableRef.current as UnifiedPhase)
    : phase;
  const anchorIndex = Math.max(0, REVIEW_PHASE_ORDER.indexOf(anchorPhase));

  // Telemetria fail-soft: registra cada NOVA travessia de fase-fantasma
  // (uma vez por par phase→anchor) para auditoria.
  useEffect(() => {
    if (!shouldAnchor) return;
    const key = `${phase}>${anchorPhase}`;
    if (lastTrackedAnchorRef.current === key) return;
    lastTrackedAnchorRef.current = key;
    void trackOnboardingEvent({
      phase: anchorPhase as any,
      event: 'review_anchor_used',
      meta: {
        variant: 'unified',
        ghost_phase: phase,
        anchor_phase: anchorPhase,
        anchor_index: anchorIndex,
      },
    });
  }, [shouldAnchor, phase, anchorPhase, anchorIndex]);

  return {
    anchorPhase,
    isAnchored: shouldAnchor,
    anchorIndex,
  };
}

/**
 * Resolve um label de fase para o HUD, garantindo NUNCA retornar string
 * vazia. Quando a fase é desconhecida, retorna fallback "Etapa em revisão"
 * — invariante de UX: o HUD jamais mostra label vazio.
 */
export function resolveUnifiedPhaseLabel(
  labelMap: Partial<Record<UnifiedPhase, string>>,
  phase: UnifiedPhase,
): string {
  const v = labelMap[phase];
  if (typeof v === 'string' && v.trim().length > 0) return v;
  return 'Etapa em revisão';
}
