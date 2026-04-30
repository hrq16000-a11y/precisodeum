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
  | 'phase_exit' // saída de uma fase com duração medida (time-on-phase)
  | 'abandon';   // ainda não usado — reservado para detector de saída

/** Origem do rascunho carregado para a sessão atual. */
export type OnboardingDraftSource = 'none' | 'local' | 'remote' | 'seed';

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
    let meta = intent && !('intent' in baseMeta) ? { ...baseMeta, intent } : baseMeta;
    // Garante a dimensão `flow` em TODO evento. Se o caller não fornecer,
    // lê do sticky em sessionStorage (definido pelo shell ao detectar PJ/PF);
    // fallback `'unknown'` deixa explícito que o caller é antigo/sem contexto.
    if (!('flow' in meta)) {
      meta = { ...meta, flow: getOnboardingFlow() ?? 'unknown' };
    }
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

/* ─────────────────────────────────────────────────────────────────────────
 * Draft source — origem do rascunho carregado na sessão atual.
 * Persistido em sessionStorage para que TODOS os eventos subsequentes
 * carreguem essa dimensão (igual ao `intent`).
 * ───────────────────────────────────────────────────────────────────────── */

const DRAFT_SOURCE_KEY = 'onboarding_v2_draft_source';
const FLOW_KEY = 'onboarding_v2_flow';

export type OnboardingFlow = 'company' | 'default' | 'unknown';

export function setOnboardingFlow(flow: OnboardingFlow | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!flow) sessionStorage.removeItem(FLOW_KEY);
    else sessionStorage.setItem(FLOW_KEY, flow);
  } catch { /* fail-soft */ }
}

export function getOnboardingFlow(): OnboardingFlow | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(FLOW_KEY) as OnboardingFlow | null;
    return v || null;
  } catch { return null; }
}

export function setOnboardingDraftSource(src: OnboardingDraftSource | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!src) sessionStorage.removeItem(DRAFT_SOURCE_KEY);
    else sessionStorage.setItem(DRAFT_SOURCE_KEY, src);
  } catch { /* fail-soft */ }
}

export function getOnboardingDraftSource(): OnboardingDraftSource | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(DRAFT_SOURCE_KEY) as OnboardingDraftSource | null;
    return v || null;
  } catch { return null; }
}

/* ─────────────────────────────────────────────────────────────────────────
 * Phase timer — mede tempo gasto em cada fase.
 *
 * API:
 *  - markPhaseEnter(phase): registra timestamp de entrada
 *  - markPhaseExit(phase, opts?): calcula duração e dispara evento `phase_exit`
 *    com meta { duration_ms, draft_source, ...opts.meta }
 *
 * Idempotente: se markPhaseExit for chamado sem enter prévio, ignora.
 * Fail-soft: nunca lança.
 * ───────────────────────────────────────────────────────────────────────── */

const phaseStartedAt = new Map<string, number>();

export function markPhaseEnter(phase: OnboardingPhase): void {
  try {
    phaseStartedAt.set(String(phase), Date.now());
  } catch { /* fail-soft */ }
}

export interface PhaseExitOptions {
  userId?: string | null;
  meta?: Record<string, unknown>;
  /** Override do draft source — se omitido, lê do sessionStorage. */
  draftSource?: OnboardingDraftSource | null;
}

export async function markPhaseExit(
  phase: OnboardingPhase,
  opts: PhaseExitOptions = {},
): Promise<void> {
  try {
    const startedAt = phaseStartedAt.get(String(phase));
    if (!startedAt) return; // sem enter prévio — não emite duração espúria
    const duration_ms = Math.max(0, Date.now() - startedAt);
    phaseStartedAt.delete(String(phase));
    const draft_source = opts.draftSource ?? getOnboardingDraftSource() ?? 'none';
    await trackOnboardingEvent({
      phase,
      event: 'phase_exit',
      userId: opts.userId,
      meta: {
        duration_ms,
        draft_source,
        ...(opts.meta || {}),
      },
    });
  } catch { /* fail-soft */ }
}

/** Limpa todos os timers (útil em testes / reset de wizard). */
export function resetPhaseTimers(): void {
  phaseStartedAt.clear();
}
