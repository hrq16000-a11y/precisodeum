import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      navigate('/login');
      setLoading(false);
      return;
    }

    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
      .then(({ data }) => {
        if (!data) navigate('/dashboard');
        setIsAdmin(!!data);
        setLoading(false);
      });
  }, [user, authLoading, navigate]);

  return { isAdmin, loading: loading || authLoading, user };
};
