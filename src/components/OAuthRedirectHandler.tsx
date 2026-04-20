import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * After OAuth login (Google), redireciona para o /dashboard (triagem decide o destino final)
 * — exceto quando o usuário já está numa rota interna válida.
 */
const OAuthRedirectHandler = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handled = useRef(false);

  useEffect(() => {
    if (loading || handled.current) return;
    if (!user) return;

    const saved = sessionStorage.getItem('auth_redirect');
    if (saved) {
      handled.current = true;
      sessionStorage.removeItem('auth_redirect');
      navigate(saved, { replace: true });
      return;
    }

    // Após OAuth, o Google retorna para "/" ou "/login" — encaminhar para /dashboard.
    const path = location.pathname;
    if (path === '/' || path === '/login' || path === '/cadastro') {
      handled.current = true;
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate, location.pathname]);

  return null;
};

export default OAuthRedirectHandler;
