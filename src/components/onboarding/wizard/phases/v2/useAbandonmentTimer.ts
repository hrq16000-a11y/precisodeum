/**
 * useAbandonmentTimer — detecta abandono silencioso em uma fase do onboarding.
 *
 * Emite `abandonment_suspected` (1x por fase por sessão) após 15min sem
 * interação no documento. Reset em qualquer evento de mouse/teclado/touch.
 *
 * Sem UI, sem modal — apenas telemetria. Sem `setInterval` (timer único).
 */

import { useEffect, useRef } from 'react';
import { trackOnboardingEvent } from './telemetry';
import type { OnboardingPhase } from './types';

const ABANDON_MS = 15 * 60 * 1000; // 15 minutos
const SS_KEY_PREFIX = 'onboarding_v2_abandon_emitted:';

function alreadyEmitted(phase: string): boolean {
  try {
    return sessionStorage.getItem(SS_KEY_PREFIX + phase) === '1';
  } catch {
    return false;
  }
}
function markEmitted(phase: string) {
  try {
    sessionStorage.setItem(SS_KEY_PREFIX + phase, '1');
  } catch { /* fail-soft */ }
}

export function useAbandonmentTimer(
  phase: OnboardingPhase,
  userId?: string | null,
  /** Quando true, o hook é no-op (ex.: onboarding já concluído). */
  disabled: boolean = false,
) {
  const timerRef = useRef<number | null>(null);
  const mountedAtRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (disabled) return;
    // Guard #1: tab inicia hidden/backgrounded — usuário nem viu a página.
    // Não armar timer; só armaremos quando ele voltar (visibilitychange).
    const startedHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    mountedAtRef.current = Date.now();
    const phaseStr = String(phase);

    const clear = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const schedule = () => {
      clear();
      if (alreadyEmitted(phaseStr)) return; // Guard #3: 1x por fase/sessão
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      timerRef.current = window.setTimeout(() => {
        if (alreadyEmitted(phaseStr)) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        markEmitted(phaseStr);
        void trackOnboardingEvent({
          phase,
          event: 'error',
          userId: userId || null,
          meta: { kind: 'abandonment_suspected', idle_ms: ABANDON_MS },
        });
      }, ABANDON_MS);
    };

    // Atividade real (input) → re-arma o timer.
    const onActivity = () => schedule();
    // Visibilidade muda → cancela quando vai pra background e re-arma quando volta.
    // Fecha a janela em que setTimeout poderia disparar enquanto a aba está oculta.
    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        clear();
      } else {
        schedule();
      }
    };
    const activityEvents = ['pointerdown', 'keydown', 'touchstart'] as const;
    activityEvents.forEach((e) => window.addEventListener(e, onActivity, { passive: true } as any));
    window.addEventListener('visibilitychange', onVisibility);
    if (!startedHidden) schedule();
    return () => {
      clear();
      activityEvents.forEach((e) => window.removeEventListener(e, onActivity as any));
      window.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase, userId, disabled]);
}
