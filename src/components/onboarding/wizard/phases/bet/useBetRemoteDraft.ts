/**
 * useBetRemoteDraft — sincroniza o rascunho da Triagem com o banco.
 *
 * Cobre o caso "troca de dispositivo / limpa cache":
 *  - useBetDraft (localStorage) → resiliência local instantânea.
 *  - este hook (Supabase `bet_drafts`) → cobre dispositivos diferentes.
 *
 * Privacidade: tabela com RLS por user_id — só o próprio usuário lê/escreve.
 * Idempotente: upsert por user_id, debounce 1.5s.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { BetState } from './types';
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';

const REMOTE_DEBOUNCE_MS = 1500;

export interface RemoteBetDraft {
  payload: Partial<BetState>;
  phase: BetState['phase'];
  updated_at: string;
}

/** Busca o rascunho remoto. Fail-soft: retorna null em qualquer erro. */
export async function fetchRemoteBetDraft(userId: string): Promise<RemoteBetDraft | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('bet_drafts')
      .select('payload, phase, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return data as RemoteBetDraft;
  } catch {
    return null;
  }
}

/** Apaga o rascunho remoto — chamar ao concluir/handoff. Fail-soft. */
export async function clearRemoteBetDraft(userId: string): Promise<void> {
  try {
    await (supabase as any).from('bet_drafts').delete().eq('user_id', userId);
  } catch { /* noop */ }
}

/**
 * Persiste o estado remotamente com debounce.
 * - Pula até a primeira hidratação remota (firstRun) para não sobrescrever
 *   antes de o caller ter a chance de mesclar payload existente.
 * - Não persiste fases finais.
 */
export function useBetRemoteDraft(state: BetState, userId: string | undefined, options: { ready: boolean }) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (!options.ready) return;
    if (state.phase === 'done' || state.phase === 'celebration') return;

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = scheduleWizardTimeout(
      { phase: state.phase as any, action: 'autosave_bet_remote', runIfStale: true },
      async () => {
        try {
          await (supabase as any).from('bet_drafts').upsert({
            user_id: userId,
            payload: state,
            phase: state.phase,
          }, { onConflict: 'user_id' });
        } catch {
          /* fail-soft — local draft cobre */
        }
      },
      REMOTE_DEBOUNCE_MS,
    );

    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [state, userId, options.ready]);
}
