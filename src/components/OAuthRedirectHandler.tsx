import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * After OAuth login (Google), decide o destino:
 *  - Sem profile_type → /triagem (Hard Gate)
 *  - Com profile_type → rota salva ou /dashboard
 */
const OAuthRedirectHandler = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handled = useRef(false);

  useEffect(() => {
    if (loading || handled.current) return;
    if (!user) return;

    // Aguarda o profile carregar para decidir entre /triagem e destino real.
    if (!profile) return;

    const path = location.pathname;
    const isEntryPath = path === '/' || path === '/login' || path === '/cadastro';
    const saved = sessionStorage.getItem('auth_redirect');

    // Sem tipo definido: força triagem.
    if (!profile.profile_type) {
      handled.current = true;
      if (path !== '/triagem') navigate('/triagem', { replace: true });
      return;
    }

    if (saved) {
      handled.current = true;
      sessionStorage.removeItem('auth_redirect');
      navigate(saved, { replace: true });
      return;
    }

    if (isEntryPath) {
      handled.current = true;
      navigate('/dashboard', { replace: true });
    }
  }, [user, profile, loading, navigate, location.pathname]);

  return null;
};

export default OAuthRedirectHandler;
