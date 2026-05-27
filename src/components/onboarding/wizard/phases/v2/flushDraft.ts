/**
 * flushOnboardingV2Draft — força a persistência imediata (local + remoto)
 * do estado do wizard, sem esperar pelo debounce.
 *
 * Usado pelos handlers de "Salvar e continuar" para garantir que o usuário
 * não perca dados se fechar a aba logo após avançar.
 *
 * Coordenação anti-duplicação (refactor 2026):
 *  - Quando este módulo escreve no remoto, registra `lastRemoteWriteAt` e a
 *    fase escrita. O hook `useOnboardingV2RemoteDraft` consulta esse marcador
 *    via `wasRemoteDraftWrittenRecently` e pula o próprio upsert debounced
 *    se a mesma fase já foi gravada nos últimos 2s — eliminando a chamada
 *    dupla ao Supabase no clique de "Salvar e continuar".
 */
import { supabase } from '@/integrations/supabase/client';
import type { OnboardingState } from './types';
import { broadcastDraftChange, isTabLeader } from './crossTabSync';

// Mantido em sincronia com `useOnboardingV2Draft.ts` (versão V3 de ruptura).
const DRAFT_KEY = 'onboarding_v3_institutional_final';

/**
 * Dedupe escopado por usuário (Map<userId, {phase, at}>).
 *
 * Por que escopado: múltiplos wizards podem coexistir na mesma aba (ex.: dev
 * tools, testes, futuras flows admin "acessar como"). Variáveis globais
 * causariam falso-positivo ("já gravei essa fase") entre instâncias distintas.
 *
 * Para callers sem userId (raro, fluxo anônimo de inspeção), usamos a chave
 * sentinela `'__anon__'` — preserva o comportamento antigo de bloqueio.
 */
type RemoteWriteMark = { phase: string | null; at: number };
const remoteWriteByUser = new Map<string, RemoteWriteMark>();
const REMOTE_DEDUPE_MS = 2000;
const ANON_KEY = '__anon__';

function userKey(userId: string | null | undefined): string {
  return userId && userId.length > 0 ? userId : ANON_KEY;
}

export function markRemoteDraftWritten(
  phase: string | null | undefined,
  userId?: string | null,
): void {
  remoteWriteByUser.set(userKey(userId), {
    phase: phase ? String(phase) : null,
    at: Date.now(),
  });
}

export function wasRemoteDraftWrittenRecently(
  phase: string | null | undefined,
  userId?: string | null,
): boolean {
  const mark = remoteWriteByUser.get(userKey(userId));
  if (!mark || !mark.phase) return false;
  if (Date.now() - mark.at > REMOTE_DEDUPE_MS) return false;
  return mark.phase === String(phase ?? '');
}

/** Test-only: limpa marcadores entre testes. */
export function __resetRemoteDraftDedupe(): void {
  remoteWriteByUser.clear();
}

export function flushLocalDraft(state: OnboardingState) {
  if (typeof window === 'undefined') return;
  try {
    const envelope = {
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
  } catch { /* quota cheia — ignora */ }
}

/**
 * In-flight registry: coalesce chamadas concorrentes ao mesmo (userId, phase).
 *
 * Por que: em rede lenta, cliques rápidos no Voltar podiam disparar 2-3
 * UPDATEs simultâneos no Supabase para o mesmo registro. Como o cliente
 * envia um snapshot do `state` capturado na hora da chamada, a 2ª resposta
 * podia chegar DEPOIS da 1ª e sobrescrever campos mais novos com payload
 * antigo (race no `last-write-wins`).
 *
 * Solução: enquanto há um upsert in-flight para uma fase, retornamos a
 * MESMA Promise em vez de iniciar outra. Após resolver, o dedupe de 2s
 * (markRemoteDraftWritten) cobre os próximos cliques.
 */
const inFlightByUser = new Map<string, Promise<void>>();

export function isFlushingRemoteDraft(userId?: string | null): boolean {
  return inFlightByUser.has(userKey(userId));
}

/** Test-only: limpa locks in-flight entre testes. */
export function __resetRemoteDraftInFlight(): void {
  inFlightByUser.clear();
}

function emitFlushEvent(kind: 'start' | 'end') {
  if (typeof window === 'undefined') return;
  try { window.dispatchEvent(new CustomEvent(`onboarding:remote-flush:${kind}`)); } catch { /* noop */ }
}

/** Fases pertencentes à triagem (BetModeShell). Se a fase recebida em
 *  `flushRemoteDraft` casar com qualquer uma delas, o write é rejeitado
 *  para evitar contaminar `onboarding_v2_drafts` com payload do shell errado. */
const BET_PHASES = new Set<string>([
  'identity', 'who', 'client_city', 'pro_kind', 'pro_document', 'pro_location', 'celebration',
]);

/** Detecta payload de triagem chegando ao draft V2 (write zumbi após handoff). */
function isTriagePayload(state: OnboardingState): boolean {
  const phase = state.phase ? String(state.phase) : '';
  if (BET_PHASES.has(phase)) return true;
  const anyState = state as unknown as Record<string, unknown>;
  if ('intent' in anyState && anyState.intent != null) return true;
  if ('triage_who' in anyState) return true;
  if ('bet_phase' in anyState) return true;
  return false;
}

export async function flushRemoteDraft(
  state: OnboardingState,
  userId: string | undefined,
): Promise<void> {
  if (!userId || state.phase === 'done') return;
  // Multi-tab: apenas a aba líder escreve no Supabase. Seguidoras saem
  // silenciosamente e registram telemetria — sem toast (background).
  if (!isTabLeader()) {
    try {
      const { trackOnboardingEvent } = await import('./telemetry');
      await trackOnboardingEvent({
        phase: state.phase as any,
        event: 'error' as any,
        userId,
        meta: {
          kind: 'flush_blocked_non_leader',
          source: 'flushRemoteDraft',
        },
      });
    } catch { /* fail-soft */ }
    return;
  }
  // Anti-zumbi: bloqueia writes vindos de timers remanescentes do BetModeShell
  // que carregam payload de triagem para a tabela do V2.
  if (isTriagePayload(state)) {
    try {
      const { trackOnboardingEvent } = await import('./telemetry');
      await trackOnboardingEvent({
        phase: state.phase as any,
        event: 'error' as any,
        userId,
        meta: {
          kind: 'zombie_write_blocked',
          error_code: 'zombie_write_blocked',
          source: 'flushRemoteDraft',
          phase_received: String(state.phase ?? ''),
        },
      });
    } catch { /* fail-soft */ }
    return;
  }
  // Guarda simétrica: se o hook debounced (ou outro flush) já gravou esta
  // mesma fase para este userId nos últimos 2s, pulamos para eliminar a 2ª
  // escrita redundante no Supabase quando o usuário avança rápido.
  if (wasRemoteDraftWrittenRecently(state.phase as any, userId)) {
    if (typeof window !== 'undefined') {
      try {
        const { recordWizardSupabaseCall } = await import('./diagnostics');
        recordWizardSupabaseCall('flushRemoteDraft.skipped', state.phase as any, userId);
      } catch { /* fail-soft */ }
    }
    return;
  }
  // Idempotência: se já existe um flush in-flight para este usuário,
  // aguardamos o mesmo (não disparamos um novo UPDATE concorrente).
  const key = userKey(userId);
  const inFlight = inFlightByUser.get(key);
  if (inFlight) {
    if (typeof window !== 'undefined') {
      try {
        const { recordWizardSupabaseCall } = await import('./diagnostics');
        recordWizardSupabaseCall('flushRemoteDraft.coalesced', state.phase as any, userId);
      } catch { /* fail-soft */ }
    }
    return inFlight;
  }
  emitFlushEvent('start');
  const promise = (async () => {
    try {
      // TODO: tipar payload (onboarding_v2_drafts ainda não está no schema gerado)
      await supabase.from('onboarding_v2_drafts' as any).upsert({
        user_id: userId,
        payload: {
          profile: state.profile,
          service: state.service,
          userRef: state.userRef,
          providerId: state.providerId,
          firstServiceId: state.firstServiceId,
        },
        phase: state.phase,
      } as any, { onConflict: 'user_id' });
      markRemoteDraftWritten(state.phase as any, userId);
      if (typeof window !== 'undefined') {
        try {
          const { recordWizardSupabaseCall } = await import('./diagnostics');
          recordWizardSupabaseCall('flushRemoteDraft', state.phase as any, userId);
        } catch { /* fail-soft */ }
      }
    } catch (e: any) {
      // Background flush: SEM toast. Apenas telemetria para diagnóstico.
      try {
        const { trackOnboardingEvent } = await import('./telemetry');
        await trackOnboardingEvent({
          phase: state.phase as any,
          event: 'error' as any,
          userId,
          meta: {
            kind: 'flush_draft_failed',
            error_code: e?.code || null,
            error: String(e?.message || e || 'unknown').slice(0, 240),
            source: 'flushRemoteDraft',
          },
        });
      } catch { /* fail-soft — telemetria não pode quebrar runtime */ }
    }
  })();
  inFlightByUser.set(key, promise);
  try {
    await promise;
  } finally {
    inFlightByUser.delete(key);
    emitFlushEvent('end');
  }
}

/**
 * Flush completo (local + remoto). Não bloqueia a UI:
 * o local é síncrono, o remoto roda em fire-and-forget.
 */
export function flushOnboardingV2Draft(
  state: OnboardingState,
  userId: string | undefined,
) {
  flushLocalDraft(state);
  // Fire-and-forget, mas captura erros para não estourar Promise não tratada.
  void flushRemoteDraft(state, userId).catch(() => { /* fail-soft */ });
}

