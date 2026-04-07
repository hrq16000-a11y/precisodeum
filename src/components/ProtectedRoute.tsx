import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedTypes?: string[];
  requireAuth?: boolean;
}

const ProtectedRoute = ({ children, allowedTypes, requireAuth = true }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;

    if (requireAuth && !user) {
      // Save the current URL so login can redirect back
      navigate('/login', { replace: true, state: { from: location.pathname + location.search } });
      return;
    }

    if (allowedTypes && profile) {
      const profileType = profile.profile_type || 'client';
      if (!allowedTypes.includes(profileType)) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [loading, user, profile, allowedTypes, requireAuth, navigate, location]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-3 w-full max-w-md px-4">
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (requireAuth && !user) return null;

  if (allowedTypes && profile) {
    const profileType = profile.profile_type || 'client';
    if (!allowedTypes.includes(profileType)) return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
