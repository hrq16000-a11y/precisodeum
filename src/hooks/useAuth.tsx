import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { usePresenceTracker } from '@/hooks/useOnlinePresence';
import { geocodeCity } from '@/lib/geoUtils';

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

  const fetchProfile = useCallback(async (userId: string, authUser?: User | null) => {
    let [{ data: profileData }, { data: providerRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(),
      supabase
        .from('providers')
        .select('*, categories(name, slug, icon)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
    ]);

    const pendingSignupType = (() => {
      try {
        const raw = sessionStorage.getItem('pending_signup_profile_type');
        return raw === 'client' || raw === 'provider' ? raw : null;
      } catch {
        return null;
      }
    })();

    if (profileData && pendingSignupType && profileData.profile_type !== pendingSignupType) {
      const nextProfile = {
        profile_type: pendingSignupType,
        role: pendingSignupType,
        onboarding_completed: true,
      };

      const { error: syncProfileError } = await supabase
        .from('profiles')
        .update(nextProfile as any)
        .eq('id', userId);

      if (!syncProfileError) {
        await supabase.auth.updateUser({ data: { profile_type_chosen: true, profile_type: pendingSignupType } }).catch(() => {});
        profileData = { ...profileData, ...nextProfile };
        try { sessionStorage.removeItem('pending_signup_profile_type'); } catch {}
      }
    }

    setProfile(profileData);

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
      setProvider(best);

      if (best.city && best.city !== 'Não informada' && best.state && (best.latitude == null || best.longitude == null)) {
        window.setTimeout(() => {
          geocodeCity(best.city, best.state)
            .then(({ latitude, longitude }) => {
              if (latitude != null && longitude != null) {
                supabase.from('providers').update({ latitude, longitude }).eq('id', best.id).then(() => {
                  setProvider(prev => prev ? { ...prev, latitude, longitude } : prev);
                });
              }
            })
            .catch(() => {});
        }, 1200);
      }
    } else {
      setProvider(null);
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
    // Safety net: never block UI for more than 3s on initial auth
    const safetyTimer = window.setTimeout(() => setLoading(false), 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Background fetch — do NOT toggle global loading
          setTimeout(() => {
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
          setNeedsTypeSelection(false);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setLoading(true);
          fetchProfile(session.user.id, session.user)
            .catch((err) => console.error('[useAuth] initial fetchProfile failed:', err))
            .finally(() => {
              setLoading(false);
              window.clearTimeout(safetyTimer);
            });
        } else {
          setLoading(false);
          window.clearTimeout(safetyTimer);
        }
      })
      .catch((err) => {
        console.error('[useAuth] getSession failed:', err);
        setLoading(false);
        window.clearTimeout(safetyTimer);
      });

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(safetyTimer);
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setProvider(null);
    setNeedsTypeSelection(false);
  };
  // Track online presence for the current user, including their city
  const providerCity = provider?.city;
  const presenceMeta = useMemo(() => (providerCity ? { city: providerCity } : undefined), [providerCity]);
  usePresenceTracker(user?.id, presenceMeta);

  return (
    <AuthContext.Provider value={{ session, user, profile, provider, loading, needsTypeSelection, signOut, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
