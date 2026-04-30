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
import { broadcastDraftChange } from './crossTabSync';

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

export async function flushRemoteDraft(
  state: OnboardingState,
  userId: string | undefined,
): Promise<void> {
  if (!userId || state.phase === 'done') return;
  try {
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
    markRemoteDraftWritten(state.phase as any);
  } catch { /* fail-soft */ }
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

