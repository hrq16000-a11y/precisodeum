/**
 * useReviewPhasePersistence — persiste a última fase renderizável visitada
 * no modo revisão (`edit_profile`) em sessionStorage.
 *
 * OBJETIVO: prevenir saltos no contador X/19 quando o usuário dá refresh
 * no meio da régua ou navega entre rotas e volta. Sem isso, o WizardShell
 * sempre re-iniciaria em `triage_identity` e o numerador "saltava" para 1.
 *
 * REGRAS (fonte ÚNICA da verdade):
 *  - Só persiste fases renderáveis presentes em `REVIEW_PHASE_ORDER`
 *    (fantasmas como `main_action`/`main_kind` JAMAIS são gravadas).
 *  - Só restaura quando `isReview=true`. Em `new_signup` retornamos null
 *    para preservar o fluxo linear original.
 *  - Persistência é fail-soft: erros de storage (modo privado, quota) são
 *    silenciados. UX nunca quebra por falha de cache.
 *
 * Vive ao lado de `useReviewAnchor` para manter toda a inteligência da
 * régua de revisão num só lugar.
 */
import { useCallback, useEffect } from 'react';
import {
  REVIEW_PHASE_ORDER,
  isReviewPhaseRenderable,
  type UnifiedPhase,
} from './wizardReviewSteps';

const STORAGE_KEY = 'wizard:review:lastRenderablePhase:v1';

function safeGet(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeSet(value: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* fail-soft */
  }
}

function safeClear(): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* fail-soft */
  }
}

/**
 * Lê (uma vez, no mount) a última fase renderizável persistida. Retorna
 * `null` se nada válido houver. Use no inicializador do reducer/wizard
 * para "rehidratar" a fase corrente após refresh.
 */
export function readPersistedReviewPhase(isReview: boolean): UnifiedPhase | null {
  if (!isReview) return null;
  const raw = safeGet();
  if (!raw) return null;
  const phase = raw as UnifiedPhase;
  if (REVIEW_PHASE_ORDER.indexOf(phase) < 0) return null;
  if (!isReviewPhaseRenderable(phase)) return null;
  return phase;
}

/**
 * Hook: a cada mudança de fase, persiste se for renderizável. Limpa o
 * storage quando atingir `done` ou quando o modo deixa de ser revisão.
 */
export function useReviewPhasePersistence(phase: UnifiedPhase, isReview: boolean): void {
  useEffect(() => {
    if (!isReview) return;
    if (phase === 'done') {
      safeClear();
      return;
    }
    if (REVIEW_PHASE_ORDER.indexOf(phase) >= 0 && isReviewPhaseRenderable(phase)) {
      safeSet(phase);
    }
  }, [phase, isReview]);
}

/** Helper para limpeza explícita (ex.: ao finalizar onboarding). */
export const clearPersistedReviewPhase = safeClear;

/** Útil para testes. */
export const __TEST__ = { STORAGE_KEY };
