/**
 * useOnboardingV2Draft — auto-save local do estado do wizard V2.
 *
 * Persiste `profile`, `service` e `phase` em localStorage com debounce,
 * sobrevivendo a F5/troca de aba. Restauração explícita via `readDraft`.
 *
 * NÃO sincroniza com o banco — a persistência remota acontece nos passos
 * "âncora" (fim de Fase 1, criação do serviço, patches da Fase 4) e é
 * suficiente; o draft local cobre só o "voei minha aba sem querer".
 */

import { useEffect, useRef } from 'react';
import type { OnboardingState } from './types';
import { broadcastDraftChange } from './crossTabSync';

const DRAFT_KEY = 'onboarding_v2_draft_v1';
const DEBOUNCE_MS = 600;
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

interface DraftEnvelope {
  savedAt: number;
  profile: OnboardingState['profile'];
  service: OnboardingState['service'];
  phase: OnboardingState['phase'];
  providerId: OnboardingState['providerId'];
  firstServiceId: OnboardingState['firstServiceId'];
}

export function readOnboardingV2Draft(): Partial<OnboardingState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope;
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - (parsed.savedAt || 0) > MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return {
      profile: parsed.profile,
      service: parsed.service,
      phase: parsed.phase,
      providerId: parsed.providerId ?? null,
      firstServiceId: parsed.firstServiceId ?? null,
    };
  } catch {
    return null;
  }
}

export function clearOnboardingV2Draft() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
}

/**
 * Salva automaticamente o estado em localStorage com debounce.
 * Pula a 1ª execução (montagem) para evitar sobrescrever um draft restaurado.
 */
export function useOnboardingV2Draft(state: OnboardingState) {
  const firstRun = useRef(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      try {
        const envelope: DraftEnvelope = {
          savedAt: Date.now(),
          profile: state.profile,
          service: state.service,
          phase: state.phase,
          providerId: state.providerId,
          firstServiceId: state.firstServiceId,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(envelope));
        broadcastDraftChange('local-write');
      } catch {
        /* quota cheia — ignora */
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [state.profile, state.service, state.phase, state.providerId, state.firstServiceId]);
}
