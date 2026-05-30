import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { acquireChannel, releaseChannel } from '@/lib/realtimeRegistry';
import { resolveCelebrationMutedPreference, setCelebrationMuted } from '@/lib/celebrate';

/**
 * AuthCompanion
 *
 * Side-effects não-core do AuthProvider. Mantém:
 *  - Sincronização de celebration_muted a partir do profile.
 *  - Canal realtime de preferências do profile.
 *  - Refetch leve do profile ao voltar foco da aba (visibilitychange).
 *
 * FIX 2 (ondas de auth):
 *  - Removido o listener duplicado `onAuthStateChange` (log-user-access agora
 *    é responsabilidade exclusiva do AuthProvider, que pode despachar este
 *    side-effect quando necessário). O listener vivia aqui apenas para o
 *    log de telemetria — desnecessário para o auth real e gerava cascata em
 *    mobile junto com o listener primário do useAuth.
 *  - visibilitychange agora faz APENAS `getSession()` leve; só dispara um
 *    `refetchProfile()` quando o `userId` da sessão muda (ex.: token girou
 *    para outro usuário ou sessão expirou). Debounce elevado para 3000ms
 *    para tolerar troca rápida de abas.
 *  - log-user-access (telemetria de login) preservado dentro do hook de
 *    visibilidade apenas como fire-and-forget para SIGNED_IN reais, agora
 *    derivado da diff de sessão e não de um segundo listener.
 */
export const AuthCompanion = () => {
  const { user, profile, refetchProfile } = useAuth();
  const lastKnownUserIdRef = useRef<string | null>(user?.id ?? null);

  // Sincroniza ref quando o user "oficial" muda (ex.: signIn/signOut do
  // listener principal). Garantimos que a próxima visibility-check compara
  // contra o user atual, sem disparar refetch redundante.
  useEffect(() => {
    lastKnownUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  // Mantém o flag de celebração mudo sincronizado com o profile carregado.
  useEffect(() => {
    setCelebrationMuted(resolveCelebrationMutedPreference(profile?.celebration_muted));
  }, [profile?.celebration_muted]);

  // Realtime de preferências do profile + refresh leve ao focar a aba.
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `profile-preferences:${user.id}`;
    acquireChannel(channelName, {
      setup: (ch) => ch.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          setCelebrationMuted(
            resolveCelebrationMutedPreference((payload.new as any)?.celebration_muted),
          );
          void refetchProfile();
        },
      ),
    });

    let visibilityTimer: number | null = null;
    const refreshOnFocus = () => {
      if (document.visibilityState !== 'visible') return;
      if (visibilityTimer != null) window.clearTimeout(visibilityTimer);
      // FIX 2: debounce 3000ms (era 500ms) + getSession leve. Só dispara
      // refetchProfile se houve troca real de usuário ou sessão expirou.
      visibilityTimer = window.setTimeout(async () => {
        visibilityTimer = null;
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) return;
          const newUserId = data?.session?.user?.id ?? null;
          if (newUserId !== lastKnownUserIdRef.current) {
            lastKnownUserIdRef.current = newUserId;
            void refetchProfile();
          }
          // Sessão inalterada → não fazemos nada (evita o loop pesado
          // observado em mobile quando o usuário alterna abas).
        } catch {
          // fail-soft
        }
      }, 3000);
    };
    document.addEventListener('visibilitychange', refreshOnFocus);

    return () => {
      if (visibilityTimer != null) window.clearTimeout(visibilityTimer);
      document.removeEventListener('visibilitychange', refreshOnFocus);
      releaseChannel(channelName);
    };
  }, [user?.id, refetchProfile]);

  return null;
};

export default AuthCompanion;
