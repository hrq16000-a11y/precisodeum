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
  const [loading, setLoading] = useState(true);
  const [needsTypeSelection, setNeedsTypeSelection] = useState(false);

  const fetchProfile = useCallback(async (userId: string, authUser?: User | null) => {
    const [{ data: profileData }, { data: providerRows }] = await Promise.all([
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

    setProfile(profileData);

    const metaChosen = authUser?.user_metadata?.profile_type_chosen === true;
    const hasType = !!profileData?.profile_type;
    // Força escolha se: (a) banco não tem profile_type definido, OU (b) metadata não marca como escolhido
    setNeedsTypeSelection(!!profileData && (!hasType || !metaChosen));

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

    const [{ data: authData }, profileData] = await Promise.all([
      supabase.auth.getUser(),
      fetchProfile(user.id, user),
    ]);

    const freshUser = authData.user ?? user;
    if (freshUser !== user) setUser(freshUser);

    const freshProfile = await fetchProfile(user.id, freshUser);
    setNeedsTypeSelection(false);
    return freshProfile ?? profileData ?? null;
  }, [user, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) {
          setTimeout(() => { void fetchProfile(session.user.id, session.user); }, 0);
          // Log access (IP, ISP, UA) for legal audit on every fresh sign-in
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
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        void fetchProfile(session.user.id, session.user);
      }
    });

    return () => subscription.unsubscribe();
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
