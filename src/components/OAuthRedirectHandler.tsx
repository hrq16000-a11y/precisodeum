import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * After OAuth login (Google), checks sessionStorage for a saved redirect URL
 * and navigates the user back to where they were.
 */
const OAuthRedirectHandler = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (loading || handled.current) return;
    if (!user) return;

    const saved = sessionStorage.getItem('auth_redirect');
    if (saved) {
      handled.current = true;
      sessionStorage.removeItem('auth_redirect');
      navigate(saved, { replace: true });
    }
  }, [user, loading, navigate]);

  return null;
};

export default OAuthRedirectHandler;
