import { useEffect, useState } from 'react';
import { useAuthIdentity } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Passive admin check via has_role() RPC.
 *
 * Unlike useAdmin() (which redirects non-admins to /login or /dashboard),
 * this hook is safe to use in always-mounted components like Header or
 * SponsorAdSlot just to conditionally render admin-only debug UI.
 *
 * NEVER gate admin checks on the mutable profiles.role column — always use
 * has_role() so a self-elevated profile cannot unlock admin UI.
 */
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const { user, loading: authLoading } = useAuthIdentity();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        if (cancelled) return;
        setIsAdmin(!error && data === true);
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading };
}
