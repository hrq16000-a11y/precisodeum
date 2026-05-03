/**
 * finalizeOnboarding — ENTRYPOINT ÚNICO para concluir o onboarding.
 *
 * Antes desta blindagem, 4 callsites distintos faziam
 * `update profiles set onboarding_completed=true` cada um com sua própria
 * limpeza (ou ausência dela) de drafts e do session lock. Isso criava as
 * condições de corrida que ejetavam o usuário do wizard.
 *
 * Agora, TODOS os pontos de finalização delegam aqui:
 *   - WizardShell.finalizeUnifiedOnboarding
 *   - OnboardingV2Shell.persistFirstService (publicação do 1º serviço)
 *   - OnboardingV2Shell.finishWizard (pós `done`)
 *   - BetModeShell.finishClient / finishRh / finishSponsor (fast-pass)
 *
 * Responsabilidades (na ordem):
 *  1) RELEASE do active-session lock (antes do navigate, para que o Gate
 *     pare de proteger e o redirect canônico aconteça).
 *  2) Marcar `markOnboardingCompletionGrace` (janela curta para o Gate
 *     tolerar o estado em trânsito, redundante com o lock e com o flag
 *     definitivo no banco — defesa em profundidade).
 *  3) Update `profiles.onboarding_completed=true` + `onboarding_step=5`,
 *     mesclando um `extraProfilePatch` quando o callsite precisa gravar
 *     campos adicionais (ex.: `profile_type` correto para client/rh).
 *  4) Limpeza de drafts (local + remoto) tanto do V2 quanto do Bet.
 *
 * Falha: fail-soft. Em caso de erro de update, retorna `{ ok: false, error }`
 * sem lançar — o callsite decide se navega assim mesmo (ex.: finishWizard
 * sempre navega, persistFirstService aborta).
 */
import { supabase } from '@/integrations/supabase/client';
import { markOnboardingCompletionGrace } from '@/lib/onboardingAccess';
import { releaseWizardSessionLock } from '@/lib/wizardSessionLock';
import { clearOnboardingV2Draft } from '@/components/onboarding/wizard/phases/v2/useOnboardingV2Draft';
import { clearSessionTouched } from '@/components/onboarding/wizard/phases/v2/sessionTouched';
import { clearRemoteDraft } from '@/components/onboarding/wizard/phases/v2/useOnboardingV2RemoteDraft';
import { clearBetDraft } from '@/components/onboarding/wizard/phases/bet/useBetDraft';
import { clearRemoteBetDraft } from '@/components/onboarding/wizard/phases/bet/useBetRemoteDraft';

export interface FinalizeOnboardingOptions {
  userId: string | null | undefined;
  /**
   * Patch adicional a ser mesclado no UPDATE de `profiles`. Útil para
   * callsites que precisam gravar `profile_type`, `full_name`, `whatsapp`,
   * `city`, etc. junto com a finalização. NUNCA inclua `onboarding_completed`
   * ou `onboarding_step` aqui — esses campos são governados pelo módulo.
   */
  extraProfilePatch?: Record<string, unknown>;
  /**
   * Quando `true` (default), limpa drafts locais E remotos.
   * Quando `false`, mantém drafts (raríssimo — atualmente nunca usamos).
   */
  clearDrafts?: boolean;
}

export interface FinalizeOnboardingResult {
  ok: boolean;
  error?: unknown;
}

export async function finalizeOnboarding(
  options: FinalizeOnboardingOptions,
): Promise<FinalizeOnboardingResult> {
  const { userId, extraProfilePatch, clearDrafts = true } = options;

  // 1) Libera o lock ANTES de qualquer navegação subsequente. Se o callsite
  //    navegar para /dashboard logo depois, o Gate precisa estar liberado.
  releaseWizardSessionLock();

  // 2) Janela curta de "graça" — defesa em profundidade.
  markOnboardingCompletionGrace();

  // 3) Limpeza de drafts (local sempre síncrona; remota fire-and-forget).
  if (clearDrafts) {
    try { clearOnboardingV2Draft(); } catch { /* noop */ }
    try { clearSessionTouched(); } catch { /* noop */ }
    try { clearBetDraft(); } catch { /* noop */ }
    if (userId) {
      void clearRemoteDraft(userId);
      void clearRemoteBetDraft(userId);
    }
  }

  // 4) UPDATE em `profiles` (sem userId, retornamos no-op com sucesso lógico).
  if (!userId) return { ok: true };

  // Sanitiza para garantir que o callsite não consiga sobrescrever os campos
  // governados por este módulo.
  const sanitizedExtra = { ...(extraProfilePatch ?? {}) };
  delete (sanitizedExtra as any).onboarding_completed;
  delete (sanitizedExtra as any).onboarding_step;

  const payload = {
    ...sanitizedExtra,
    onboarding_step: 5,
    onboarding_completed: true,
  };

  try {
    const { error } = await supabase
      .from('profiles')
      .update(payload as any)
      .eq('id', userId);
    if (error) {
      console.warn('[finalizeOnboarding] profile update failed (fail-soft)', error);
      return { ok: false, error };
    }
  } catch (error) {
    console.warn('[finalizeOnboarding] profile update threw (fail-soft)', error);
    return { ok: false, error };
  }

  // Sinaliza o checklist do dashboard.
  try { window.dispatchEvent(new CustomEvent('onboarding-progress-changed')); } catch { /* noop */ }

  return { ok: true };
}
