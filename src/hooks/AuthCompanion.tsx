import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { acquireChannel, releaseChannel } from '@/lib/realtimeRegistry';
import { resolveCelebrationMutedPreference, setCelebrationMuted } from '@/lib/celebrate';

/**
 * AuthCompanion
 *
 * Side-effects que historicamente viviam dentro de `AuthProvider` mas NÃO
 * fazem parte do núcleo (sessão/usuário/profile). Mantemos esses efeitos
 * num componente irmão para reduzir re-renders globais e responsabilidades
 * do provider raiz.
 *
 * Cobre:
 *  - log-user-access (telemetria) no evento SIGNED_IN
 *  - sincronização de celebration_muted a partir do profile
 *  - canal realtime de preferências do profile
 *  - refetch suave do profile ao voltar foco da aba (visibilitychange)
 *
 * Geocoding e presença são tratados em hooks/locais próprios.
 */
export const AuthCompanion = () => {
  const { user, profile, refetchProfile } = useAuth();

  // log-user-access on SIGNED_IN — best-effort, fail-soft.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_IN') return;
      window.setTimeout(() => {
        supabase.functions
          .invoke('log-user-access', { body: { event_type: 'login', source: 'web' } })
          .catch(() => { /* silent */ });
      }, 500);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Mantém o flag de celebração mudo sincronizado com o profile carregado.
  useEffect(() => {
    setCelebrationMuted(resolveCelebrationMutedPreference(profile?.celebration_muted));
  }, [profile?.celebration_muted]);

  // Realtime de preferências do profile + refresh ao focar a aba.
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
      visibilityTimer = window.setTimeout(() => {
        visibilityTimer = null;
        void refetchProfile();
      }, 500);
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
