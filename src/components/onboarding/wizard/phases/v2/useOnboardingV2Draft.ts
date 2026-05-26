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
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';
import {
  DRAFT_ENVELOPE_VERSION,
  computeDraftChecksum,
  validateDraftShape,
} from './draftEnvelope';

/**
 * Versão de RUPTURA (V3): trocamos a chave para invalidar instantaneamente
 * qualquer rascunho "zumbi" salvo em versões antigas e bugadas. A purga
 * automática das chaves legadas é feita em `CadastroInicialPage` no boot.
 */
const DRAFT_KEY = 'onboarding_v3_institutional_final';
const DEBOUNCE_MS = 600;
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

interface DraftEnvelope {
  /** Versão do envelope. >=2 inclui checksum. v1 (sem campo) é descartado. */
  version?: number;
  /** Checksum FNV-1a de (profile,service,phase). Ausente em v1. */
  checksum?: string;
  savedAt: number;
  profile: OnboardingState['profile'];
  service: OnboardingState['service'];
  phase: OnboardingState['phase'];
  userRef: OnboardingState['userRef'];
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
    // Containment patch — Crítico #3: NÃO anuncia "rascunho recuperado" se
    // não há conteúdo mínimo. Antes, qualquer envelope salvo (mesmo só com
    // a fase setada) acionava o banner de recuperação enganando o usuário
    // ("recuperei seu serviço!" quando não havia serviço algum).
    const svc = parsed.service || ({} as any);
    const prof = parsed.profile || ({} as any);
    const serviceName = String(svc.service_name || '').trim();
    const whatsappDigits = String(prof.whatsapp || '').replace(/\D/g, '');
    const hasCategory = Array.isArray(svc.category_ids) && svc.category_ids.length > 0;
    const hasMeaningfulContent = serviceName.length >= 3 || whatsappDigits.length >= 10 || hasCategory;
    if (!hasMeaningfulContent) {
      return null;
    }
    return {
      profile: parsed.profile,
      service: parsed.service,
      phase: parsed.phase,
      userRef: parsed.userRef ?? null,
      providerId: parsed.providerId ?? null,
      firstServiceId: parsed.firstServiceId ?? null,
    };
  } catch {
    return null;
  }
}

/** Lê só o timestamp do envelope local — usado para resolver race condition
 *  entre draft local e remoto na hidratação inicial (Crítico #4). */
export function readOnboardingV2DraftSavedAt(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope;
    return typeof parsed?.savedAt === 'number' ? parsed.savedAt : null;
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
 *
 * `enabled=false` desliga o autosave por completo — usado em modo
 * `edit_profile`, onde o usuário está revisando dados já publicados e qualquer
 * persistência local seria poluição (e poderia mascarar dados reais do banco
 * em retornos futuros).
 */
export function useOnboardingV2Draft(state: OnboardingState, enabled: boolean = true) {
  const firstRun = useRef(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = scheduleWizardTimeout(
      { phase: state.phase as any, action: 'autosave_local_draft', runIfStale: true },
      () => {
        try {
          const envelope: DraftEnvelope = {
            savedAt: Date.now(),
            profile: state.profile,
            service: state.service,
            phase: state.phase,
            userRef: state.userRef,
            providerId: state.providerId,
            firstServiceId: state.firstServiceId,
          };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(envelope));
          broadcastDraftChange('local-write');
        } catch {
          /* quota cheia — ignora */
        }
      },
      DEBOUNCE_MS,
    );
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [state.profile, state.service, state.phase, state.userRef, state.providerId, state.firstServiceId]);
}
