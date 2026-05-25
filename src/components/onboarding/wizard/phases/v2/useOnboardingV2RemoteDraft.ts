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
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';

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
    timerRef.current = scheduleWizardTimeout(
      { phase: state.phase as any, action: 'autosave_remote_draft', runIfStale: true },
      async () => {
        // Anti-duplicação: se um flush imediato (clique "Salvar e continuar")
        // já gravou esta mesma fase nos últimos 2s para ESTE userId, pulamos
        // o upsert para evitar 2 chamadas redundantes ao Supabase.
        if (wasRemoteDraftWrittenRecently(state.phase as any, userId)) {
          recordWizardSupabaseCall('useRemoteDraft.skipped', state.phase as any, userId);
          return;
        }
        const upsertOnce = async () =>
          supabase.from('onboarding_v2_drafts' as any).upsert({
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

        const reportFailure = async (error: any, attempt: number) => {
          console.error('[onboardingV2] remote draft upsert failed', {
            phase: state.phase,
            userId,
            attempt,
            message: error?.message || String(error),
            code: error?.code || null,
            details: error?.details || null,
            hint: error?.hint || null,
          });
          // Containment patch — Crítico #5: telemetria explícita p/ falhas de
          // draft remoto. Antes era console.error silencioso e perdíamos a
          // pista quando o usuário relatava "nada foi salvo".
          try {
            const { trackOnboardingEvent } = await import('./telemetry');
            void trackOnboardingEvent({
              phase: state.phase as any,
              event: 'error',
              userId,
              meta: {
                kind: 'remote_draft_failed',
                attempt,
                code: error?.code || null,
                message: String(error?.message || error || '').slice(0, 240),
              },
            });
          } catch { /* fail-soft: telemetria nunca pode travar o fluxo */ }
        };

        try {
          const { error } = await upsertOnce();
          if (error) throw error;
          markRemoteDraftWritten(state.phase as any, userId);
          recordWizardSupabaseCall('useRemoteDraft.debounced', state.phase as any, userId);
        } catch (error: any) {
          await reportFailure(error, 1);
          // Retry simples (1 nova tentativa, sem loop). Backoff fixo 1500ms.
          window.setTimeout(async () => {
            try {
              const { error: err2 } = await upsertOnce();
              if (err2) throw err2;
              markRemoteDraftWritten(state.phase as any, userId);
              recordWizardSupabaseCall('useRemoteDraft.retry_ok', state.phase as any, userId);
            } catch (retryErr: any) {
              await reportFailure(retryErr, 2);
            }
          }, 1500);
        }
      },
      REMOTE_DEBOUNCE_MS,
    );

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [state.profile, state.service, state.phase, state.userRef, state.providerId, state.firstServiceId, userId]);
}
