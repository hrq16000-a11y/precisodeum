/**
 * Telemetria granular do Onboarding V2.
 *
 * Privacidade:
 *  - Nunca envia PII (nome, whatsapp, documento, email).
 *  - Apenas IDs (user_id quando autenticado), fase, evento e meta numérica.
 *  - session_id é gerado por aba (sessionStorage) — não persiste entre dispositivos
 *    mas correlaciona toda a jornada da mesma aba.
 *
 * Fail-soft: nunca lança. Se a telemetria falhar, o wizard continua.
 */

import { supabase } from '@/integrations/supabase/client';
import type { OnboardingPhase } from './types';

const SESSION_KEY = 'onboarding_v2_session_id';
const INTENT_KEY = 'onboarding_v2_intent';

/** Intents reais escolhidos pelo usuário no início do wizard (PhaseWho). */
export type OnboardingIntent = 'client' | 'professional' | 'rh' | 'company';

export type OnboardingEventName =
  | 'enter'      // ao montar a fase
  | 'next'       // avançou
  | 'back'       // voltou
  | 'skip'       // pulou
  | 'submit'     // chamou persistência (fim de fase 1, criação serviço, patches)
  | 'error'      // falha de persistência
  | 'complete'   // wizard concluído
  | 'abandon';   // ainda não usado — reservado para detector de saída

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto as any)?.randomUUID?.() ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}

/**
 * Persiste o intent real escolhido pelo usuário (PhaseWho/triage).
 * Sticky por sessão para que TODOS os eventos subsequentes (milestone, skip,
 * next, error, complete) carreguem essa dimensão sem precisar passar manualmente.
 */
export function setOnboardingIntent(intent: OnboardingIntent | null | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    if (!intent) sessionStorage.removeItem(INTENT_KEY);
    else sessionStorage.setItem(INTENT_KEY, intent);
  } catch {
    /* fail-soft */
  }
}

export function getOnboardingIntent(): OnboardingIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(INTENT_KEY) as OnboardingIntent | null;
    return v || null;
  } catch {
    return null;
  }
}

export interface TrackOptions {
  phase: OnboardingPhase;
  event: OnboardingEventName;
  userId?: string | null;
  /** Apenas dados não-PII: contadores, durações, flags. */
  meta?: Record<string, unknown>;
  variant?: 'v1' | 'v2';
  /** Intent explícito — se omitido, lê do sessionStorage (sticky). */
  intent?: OnboardingIntent | null;
}

export async function trackOnboardingEvent(opts: TrackOptions): Promise<void> {
  try {
    const intent = opts.intent ?? getOnboardingIntent();
    const baseMeta = opts.meta || {};
    // Auto-injeta `intent` em meta para que eventos antigos no analytics
    // ganhem essa dimensão automaticamente (sem migração de schema).
    const meta = intent && !('intent' in baseMeta) ? { ...baseMeta, intent } : baseMeta;
    const payload = {
      user_id: opts.userId || null,
      session_id: getSessionId(),
      variant: opts.variant || 'v2',
      phase: String(opts.phase),
      event: opts.event,
      meta,
    };
    // fire-and-forget; não bloqueia UI
    void supabase.from('onboarding_events' as any).insert(payload as any);
  } catch {
    /* fail-soft */
  }
}
