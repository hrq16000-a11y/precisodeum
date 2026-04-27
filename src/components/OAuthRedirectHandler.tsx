import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * After OAuth login (Google), o fluxo sempre passa por /cadastro-bet (V3).
 * O próprio gate decide a saída final se o onboarding já estiver completo.
 */
const OAuthRedirectHandler = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handled = useRef(false);

  useEffect(() => {
    if (loading || handled.current) return;
    if (!user) return;
    if (!profile) return;

    // Só redireciona para /cadastro-bet se o onboarding NÃO está completo.
    // Logins recorrentes (Google OAuth com profile já completo) devem ir
    // direto ao destino normal — o OnboardingGate já cuida do resto.
    const onboardingStep = Number(profile?.onboarding_step ?? 0);
    const mustComplete =
      !profile.profile_type ||
      profile.onboarding_completed !== true ||
      onboardingStep < 5;

    if (!mustComplete) {
      handled.current = true;
      return;
    }

    handled.current = true;
    if (location.pathname !== '/cadastro-inicial') {
      navigate('/cadastro-inicial', { replace: true });
    }
  }, [user, profile, loading, navigate, location.pathname]);

  return null;
};

export default OAuthRedirectHandler;
