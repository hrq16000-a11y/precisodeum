/**
 * flushOnboardingV2Draft — força a persistência imediata (local + remoto)
 * do estado do wizard, sem esperar pelo debounce.
 *
 * Usado pelos handlers de "Salvar e continuar" para garantir que o usuário
 * não perca dados se fechar a aba logo após avançar.
 */
import { supabase } from '@/integrations/supabase/client';
import type { OnboardingState } from './types';
import { broadcastDraftChange } from './crossTabSync';

const DRAFT_KEY = 'onboarding_v2_draft_v1';

export function flushLocalDraft(state: OnboardingState) {
  if (typeof window === 'undefined') return;
  try {
    const envelope = {
      savedAt: Date.now(),
      profile: state.profile,
      service: state.service,
      phase: state.phase,
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
      payload: { profile: state.profile, service: state.service },
      phase: state.phase,
    } as any, { onConflict: 'user_id' });
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
