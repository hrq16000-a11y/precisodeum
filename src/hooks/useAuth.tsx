import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { usePresenceTracker } from '@/hooks/useOnlinePresence';
import { geocodeCity } from '@/lib/geoUtils';
import { resolveCelebrationMutedPreference, setCelebrationMuted } from '@/lib/celebrate';
import { reportError } from '@/lib/errorReporter';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  provider: any | null;
  loading: boolean;
  /** True when the user exists but has never explicitly chosen a profile type (social login default) */
  needsTypeSelection: boolean;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<any | null>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  provider: null,
  loading: true,
  needsTypeSelection: false,
  signOut: async () => {},
  refetchProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [provider, setProvider] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsTypeSelection, setNeedsTypeSelection] = useState(false);

  // Monotonic generation counter used to discard out-of-order fetchProfile results.
  // Every new fetch bumps this; the resolver ignores its setState writes if a
  // newer generation has started in the meantime (FIX #2 — race condition).
  const fetchGenerationRef = useRef(0);

  const fetchProfile = useCallback(async (userId: string, authUser?: User | null) => {
    // Generation guard: bumped on every call. If a newer call starts before this
    // one finishes, the older one's setState writes are silently discarded.
    const generation = ++fetchGenerationRef.current;
    const isStale = () => fetchGenerationRef.current !== generation;
    // Retry/polling: o trigger handle_new_user pode levar alguns ms após o signup.
    // Evita a race condition que deixa o usuário "preso" sem profile carregado.
    let profileData: any = null;
    let providerRows: any[] | null = null;
    const MAX_ATTEMPTS = 8;
    const startedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    let attemptsUsed = 0;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      attemptsUsed = attempt + 1;
      const [{ data: pData }, { data: pvRows }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('providers').select('*, categories(name, slug, icon)').eq('user_id', userId).order('created_at', { ascending: true }),
      ]);
      profileData = pData;
      providerRows = pvRows;
      if (profileData) break;
      // Backoff: 150ms, 300ms, 600ms, 1200ms, 2400ms, 4800ms, 9600ms
      await new Promise(resolve => setTimeout(resolve, 150 * Math.pow(2, attempt)));
    }

    const elapsedMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);
    // Fire-and-forget telemetry
    supabase.from('auth_profile_metrics' as any).insert({
      user_id: userId,
      duration_ms: elapsedMs,
      attempts: attemptsUsed,
      succeeded: !!profileData,
    } as any).then(() => undefined, () => undefined);

    if (!profileData) {
      reportError({
        errorMessage: `Profile fetch timeout after ${MAX_ATTEMPTS} attempts (${elapsedMs}ms)`,
        componentName: 'useAuth',
        actionContext: 'auth.profile_timeout',
        severity: 'error',
      }).catch(() => {});
    }


    if (isStale()) return profileData ?? null;
    setProfile(profileData);
    setCelebrationMuted(resolveCelebrationMutedPreference(profileData?.celebration_muted));

    const metaChosen = authUser?.user_metadata?.profile_type_chosen === true;
    const hasType = !!profileData?.profile_type;
    // Só força o wizard quando NÃO existe profile_type no banco.
    // Se já tem tipo gravado mas a flag de metadata está ausente (contas antigas / OAuth),
    // sincroniza silenciosamente — sem reabrir o wizard.
    setNeedsTypeSelection(!!profileData && !hasType);
    if (hasType && !metaChosen) {
      supabase.auth.updateUser({ data: { profile_type_chosen: true } }).catch(() => {});
    }

    if (providerRows && providerRows.length > 0) {
      const best = providerRows.find(p => p.city && p.description) || providerRows[0];
      if (!isStale()) setProvider(best);

      if (best.city && best.city !== 'Não informada' && best.state && (best.latitude == null || best.longitude == null)) {
        window.setTimeout(() => {
          geocodeCity(best.city, best.state)
            .then(({ latitude, longitude }) => {
              if (latitude != null && longitude != null) {
                supabase.from('providers').update({ latitude, longitude }).eq('id', best.id).then(() => {
                  if (!isStale()) setProvider(prev => prev ? { ...prev, latitude, longitude } : prev);
                });
              }
            })
            .catch(() => {});
        }, 1200);
      }
    } else {
      if (!isStale()) setProvider(null);
    }

    return profileData ?? null;
  }, []);

  const refetchProfile = useCallback(async () => {
    if (!user) return null;

    const { data: authData } = await supabase.auth.getUser();

    const freshUser = authData.user ?? user;
    if (freshUser !== user) setUser(freshUser);

    // fetchProfile já recalcula needsTypeSelection com base no banco — não forçar false aqui.
    const freshProfile = await fetchProfile(user.id, freshUser);
    return freshProfile ?? null;
  }, [user, fetchProfile]);

  useEffect(() => {
    // [FIX #2 — Race Condition Guard]
    // `isMounted` impede que callbacks atrasados de auth/fetchProfile escrevam
    // estado depois do unmount. O cancelamento por geração já vive dentro de
    // `fetchProfile` (fetchGenerationRef) — aqui cuidamos apenas das writes
    // do próprio efeito (setSession/setUser/setLoading).
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Background fetch — fetchProfile internamente descarta resultados
          // obsoletos via fetchGenerationRef, então múltiplos eventos rápidos
          // (SIGNED_IN → TOKEN_REFRESHED) só aplicam o último.
          setTimeout(() => {
            if (!isMounted) return;
            try {
              void fetchProfile(session.user.id, session.user).catch((err) => {
                console.error('[useAuth] fetchProfile failed:', err);
              });
            } catch (err) {
              console.error('[useAuth] fetchProfile threw:', err);
            }
          }, 0);
          if (event === 'SIGNED_IN') {
            setTimeout(() => {
              supabase.functions.invoke('log-user-access', {
                body: { event_type: 'login', source: 'web' },
              }).catch(() => {/* silent */});
            }, 500);
          }
        } else {
          setProfile(null);
          setProvider(null);
          setCelebrationMuted(false);
          setNeedsTypeSelection(false);
          setLoading(false);
        }
      }
    );

    // [FIX #1 — Safety Timer removido]
    // O loading global agora SÓ flipa para false quando getSession()/fetchProfile()
    // realmente resolverem ou rejeitarem. Sem timer arbitrário de 3s para evitar
    // o estado fantasma `user && !profile && !loading`.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setLoading(true);
          fetchProfile(session.user.id, session.user)
            .catch((err) => console.error('[useAuth] initial fetchProfile failed:', err))
            .finally(() => {
              if (!isMounted) return;
              setLoading(false);
            });
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('[useAuth] getSession failed:', err);
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  useEffect(() => {
    if (!user?.id) return;

    const syncMutedFromProfile = (nextProfile: any) => {
      setProfile(prev => ({ ...(prev ?? {}), ...(nextProfile ?? {}) }));
      setCelebrationMuted(resolveCelebrationMutedPreference(nextProfile?.celebration_muted));
    };

    const channel = supabase
      .channel(`profile-preferences:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => syncMutedFromProfile(payload.new)
      )
      .subscribe();

    let visibilityTimer: number | null = null;
    const refreshOnFocus = () => {
      if (document.visibilityState !== 'visible') return;
      // Debounce: rapid alt-tab / tab switches should result in a single refetch.
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
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setProvider(null);
    setCelebrationMuted(false);
    setNeedsTypeSelection(false);
  }, []);
  // Track online presence for the current user, including their city
  const providerCity = provider?.city;
  const presenceMeta = useMemo(() => (providerCity ? { city: providerCity } : undefined), [providerCity]);
  usePresenceTracker(user?.id, presenceMeta);

  // Memoize the context value so consumers (~50+ across the app) don't re-render
  // unless one of the actual primitives changes. Without this, every parent
  // re-render of AuthProvider cascaded a re-render to every `useAuth()` consumer.
  const contextValue = useMemo<AuthContextType>(
    () => ({ session, user, profile, provider, loading, needsTypeSelection, signOut, refetchProfile }),
    [session, user, profile, provider, loading, needsTypeSelection, signOut, refetchProfile],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
