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

export function useAbandonmentTimer(phase: OnboardingPhase, userId?: string | null) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const phaseStr = String(phase);

    const clear = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const schedule = () => {
      clear();
      if (alreadyEmitted(phaseStr)) return;
      timerRef.current = window.setTimeout(() => {
        if (alreadyEmitted(phaseStr)) return;
        markEmitted(phaseStr);
        void trackOnboardingEvent({
          phase,
          event: 'error',
          userId: userId || null,
          meta: { kind: 'abandonment_suspected', idle_ms: ABANDON_MS },
        });
      }, ABANDON_MS);
    };

    const onActivity = () => schedule();
    const events = ['pointerdown', 'keydown', 'touchstart', 'visibilitychange'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true } as any));
    schedule();
    return () => {
      clear();
      events.forEach((e) => window.removeEventListener(e, onActivity as any));
    };
  }, [phase, userId]);
}
