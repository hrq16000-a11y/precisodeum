import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { resolvePostLoginRoute } from '@/lib/onboardingAccess';

/**
 * After OAuth login (Google), o fluxo sempre passa por /cadastro-bet (V3).
 * O próprio gate decide a saída final se o onboarding já estiver completo.
 */
const OAuthRedirectHandler = () => {
  const { user, profile, provider, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handled = useRef(false);

  useEffect(() => {
    if (loading || handled.current) return;
    if (!user) return;
    if (!profile) return;

    handled.current = true;

    void (async () => {
      const nextRoute = await resolvePostLoginRoute({
        userId: user.id,
        profile,
        provider,
        fallbackAuthorizedRoute: '/dashboard',
      });

      if (location.pathname !== nextRoute) {
        navigate(nextRoute, { replace: true });
      }
    })();
  }, [user, profile, provider, loading, navigate, location.pathname]);

  return null;
};

export default OAuthRedirectHandler;
