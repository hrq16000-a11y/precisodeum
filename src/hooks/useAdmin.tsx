import { useEffect, useState } from 'react';
import { useNavigate } from '@/lib/router-compat';
// PR 4 (A3): identidade pura — admin não depende de profile/provider.
import { useAuthIdentity } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useAdmin = () => {
  const { user, loading: authLoading } = useAuthIdentity();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Audit-fix #1 — replace:true evita loop de back-button no /login
      navigate('/login', { replace: true });
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        if (cancelled) return;
        if (error) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }
        if (!data) navigate('/dashboard', { replace: true });
        setIsAdmin(!!data);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setIsAdmin(false);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, navigate]);

  return { isAdmin, loading: loading || authLoading, user };
};
