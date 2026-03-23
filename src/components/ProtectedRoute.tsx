import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Profile types allowed to access this route */
  allowedTypes?: string[];
  /** If true, requires authentication */
  requireAuth?: boolean;
}

/**
 * Protects routes by profile type.
 * Redirects clients away from provider-only pages, etc.
 */
const ProtectedRoute = ({ children, allowedTypes, requireAuth = true }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (requireAuth && !user) {
      navigate('/login', { replace: true });
      return;
    }

    if (allowedTypes && profile) {
      const profileType = profile.profile_type || 'client';
      if (!allowedTypes.includes(profileType)) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [loading, user, profile, allowedTypes, requireAuth, navigate]);

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
