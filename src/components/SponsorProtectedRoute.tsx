import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface SponsorProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protects /sponsor-panel/* routes.
 * Only allows access if the logged-in user has an active sponsor_contacts record OR is an admin.
 */
const SponsorProtectedRoute = ({ children }: SponsorProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    Promise.all([
      supabase.from('sponsor_contacts' as any).select('id').eq('user_id', user.id).limit(1).maybeSingle(),
      supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
    ]).then(([contactRes, roleRes]) => {
      const isSponsor = !!contactRes.data;
      const isAdmin = !!roleRes.data;
      if (isSponsor || isAdmin) {
        setAllowed(true);
      } else {
        setAllowed(false);
        navigate('/dashboard', { replace: true });
      }
    });
  }, [user, authLoading, navigate]);

  if (authLoading || allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-3 w-full max-w-md px-4">
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
};

export default SponsorProtectedRoute;
