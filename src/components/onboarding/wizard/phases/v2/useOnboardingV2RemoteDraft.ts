/**
 * useOnboardingV2RemoteDraft — sincroniza o rascunho do V2 com o banco.
 *
 * Estratégia:
 *  - Local (useOnboardingV2Draft): cobre F5/abas — instantâneo.
 *  - Remoto (este hook): cobre troca de DISPOSITIVO. Debounce 1.5s, idempotente.
 *
 * Privacidade: payload completo fica em onboarding_v2_drafts (RLS por user_id),
 * só o próprio usuário lê/escreve.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OnboardingState } from './types';
import { wasRemoteDraftWrittenRecently, markRemoteDraftWritten } from './flushDraft';
import { recordWizardSupabaseCall } from './diagnostics';

const REMOTE_DEBOUNCE_MS = 1500;

export async function fetchRemoteDraft(userId: string): Promise<{
  payload: {
    profile: OnboardingState['profile'];
    service: OnboardingState['service'];
    userRef?: OnboardingState['userRef'];
    providerId?: OnboardingState['providerId'];
    firstServiceId?: OnboardingState['firstServiceId'];
  };
  phase: OnboardingState['phase'];
  updated_at: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from('onboarding_v2_drafts' as any)
      .select('payload, phase, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return data as any;
  } catch {
    return null;
  }
}

export async function clearRemoteDraft(userId: string): Promise<void> {
  try {
    await supabase.from('onboarding_v2_drafts' as any).delete().eq('user_id', userId);
  } catch { /* fail-soft */ }
}

export function useOnboardingV2RemoteDraft(state: OnboardingState, userId: string | undefined) {
  const firstRun = useRef(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (firstRun.current) { firstRun.current = false; return; }
    if (state.phase === 'done') return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      // Anti-duplicação: se um flush imediato (clique "Salvar e continuar")
      // já gravou esta mesma fase nos últimos 2s, pulamos o upsert para
      // evitar 2 chamadas redundantes ao Supabase no mesmo gesto.
      if (wasRemoteDraftWrittenRecently(state.phase as any)) return;
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
      } catch {
        /* fail-soft — local draft já cobre */
      }
    }, REMOTE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [state.profile, state.service, state.phase, state.userRef, state.providerId, state.firstServiceId, userId]);
}
