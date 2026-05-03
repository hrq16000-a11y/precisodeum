/**
 * onboardingSelfHeal — migra perfis legados de profissionais que possuem
 * `provider` + 1º serviço ativo, mas ainda têm `profile.onboarding_completed`
 * em `false`/`null`, para `onboarding_completed = true` + `onboarding_step = 5`.
 *
 * Existe para tirar essa lógica de DENTRO do `OnboardingGate`, que precisa
 * ser 100% read-only e determinístico (a fonte de truth é o profile;
 * qualquer write durante render pode causar ping-pong).
 *
 * Idempotência: por `user.id`, dispara no máximo UMA vez por aba/sessão.
 * Fail-soft: nunca lança; em caso de erro, deixa o estado como está (o gate
 * vai apenas redirecionar para o wizard, e o usuário concluir manualmente).
 */
import { supabase } from '@/integrations/supabase/client';
import {
  fetchExistingFirstService,
  findExistingProvider,
} from '@/components/onboarding/wizard/phases/v2/findExistingRecords';
import { isWizardSessionLockActive } from '@/lib/wizardSessionLock';

const HEALED_USERS = new Set<string>();
const IN_FLIGHT = new Map<string, Promise<boolean>>();

interface SelfHealInput {
  userId: string;
  profile: any | null;
  provider: any | null;
}

/**
 * Retorna `true` quando uma migração foi realmente aplicada (e o caller deve
 * forçar um `refetchProfile`). Retorna `false` quando nada precisava mudar
 * ou em qualquer falha não-fatal.
 */
export async function runOnboardingSelfHeal({
  userId,
  profile,
  provider,
}: SelfHealInput): Promise<boolean> {
  if (!userId || !profile) return false;
  if (HEALED_USERS.has(userId)) return false;

  // ── ACTIVE-SESSION LOCK (Fase 1) ────────────────────────────────────────
  // Se o Wizard está montado nesta aba, NÃO escrevemos nada no banco.
  // Qualquer write aqui dispara `refetchProfile` no Gate e ejeta o usuário
  // para `/dashboard` no próximo re-render. Aborto silencioso, sem marcar
  // HEALED para que rode normalmente assim que o Wizard for desmontado.
  if (isWizardSessionLockActive()) return false;

  // Pré-condições determinísticas: só faz sentido para profissionais cujo
  // perfil ainda não foi marcado como concluído.
  if (profile.profile_type !== 'provider') return false;
  if (profile.onboarding_completed === true) return false;

  // Coalesce de chamadas concorrentes (ex.: Gate + outro consumidor disparando
  // ao mesmo tempo no boot). Garante UMA execução por user.
  const inflight = IN_FLIGHT.get(userId);
  if (inflight) return inflight;

  const work = (async () => {
    try {
      const providerId =
        provider?.id ??
        (await findExistingProvider(userId, profile?.user_ref ?? null));

      if (!providerId) return false;

      const existingService = await fetchExistingFirstService(
        providerId,
        profile?.user_ref ?? null,
        provider?.category_id ?? profile?.primary_category_id ?? null,
      );

      if (!existingService?.id) return false;

      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_step: 5, onboarding_completed: true })
        .eq('id', userId);

      if (error) {
        // fail-soft: não marca como healed para permitir retry em outra aba
        // se o erro for transitório.
        // eslint-disable-next-line no-console
        console.warn('[onboardingSelfHeal] update failed (fail-soft)', error);
        return false;
      }

      HEALED_USERS.add(userId);
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[onboardingSelfHeal] threw (fail-soft)', err);
      return false;
    } finally {
      IN_FLIGHT.delete(userId);
    }
  })();

  IN_FLIGHT.set(userId, work);
  return work;
}

/** Apenas para testes — limpa o cache de "já curado". */
export const __testing__ = {
  reset() {
    HEALED_USERS.clear();
    IN_FLIGHT.clear();
  },
};
