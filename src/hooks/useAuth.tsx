import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  provider: any | null;
  loading: boolean;
  /** True when the user exists but has never explicitly chosen a profile type (social login default) */
  needsTypeSelection: boolean;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<void>;
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

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);

    // Check if user needs to pick a profile type
    // A social-login user who never chose will have profile_type='client' and
    // a very recent created_at (within 60s of now) OR has the provider 'google'/'apple' in auth
    // We use a simpler heuristic: profile_type is still 'client' AND
    // user metadata has no explicit profile_type_chosen flag
    const session = (await supabase.auth.getSession()).data.session;
    const metaChosen = session?.user?.user_metadata?.profile_type_chosen === true;
    const isEmailUser = session?.user?.app_metadata?.provider === 'email';
    // User already chose if: metadata flag is set, signed up via email, or type isn't the default 'client'
    const hasExplicitChoice = metaChosen || isEmailUser || data?.profile_type !== 'client';
    
    setNeedsTypeSelection(!hasExplicitChoice && !!data);

    // Fetch the most complete provider
    const { data: providerRows } = await supabase
      .from('providers')
      .select('*, categories(name, slug, icon)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    if (providerRows && providerRows.length > 0) {
      const best = providerRows.find(p => p.city && p.description) || providerRows[0];
      setProvider(best);
    } else {
      setProvider(null);
    }
  }, []);

  const refetchProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
      // After an explicit refetch (e.g. after choosing type), mark as chosen
      setNeedsTypeSelection(false);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setProvider(null);
          setNeedsTypeSelection(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
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

  return (
    <AuthContext.Provider value={{ session, user, profile, provider, loading, needsTypeSelection, signOut, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
