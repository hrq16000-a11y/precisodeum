import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * After OAuth login (Google), o fluxo sempre passa por /triagem.
 * A própria triagem decide a saída final se o profile_type já existir.
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

    handled.current = true;
    if (location.pathname !== '/triagem') {
      navigate('/triagem', { replace: true });
    }
  }, [user, profile, loading, navigate, location.pathname]);

  return null;
};

export default OAuthRedirectHandler;
