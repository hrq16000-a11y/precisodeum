/**
 * DashboardRouteGuard — wrapper para rotas /dashboard/* que exigem
 * permissão específica de profile.permissions.
 *
 * Padrão espelhado em AdminGuard: redirect + toast (não fallback inline).
 * Acesso sempre liberado para rotas básicas (perfil, notificações, etc.)
 * — essas NÃO recebem o guard.
 */
import { useEffect, useRef } from 'react';
import { Navigate } from '@/lib/router-compat';
import { toast } from 'sonner';
import { usePermissions, type ProfilePermissions } from '@/hooks/usePermissions';

interface DashboardRouteGuardProps {
  children: React.ReactNode;
  requiredPermission: keyof ProfilePermissions;
}

const DashboardRouteGuard = ({ children, requiredPermission }: DashboardRouteGuardProps) => {
  const { hasProfilePermission, loading } = usePermissions();
  const deniedToastShownRef = useRef(false);

  const allowed = hasProfilePermission(requiredPermission);

  useEffect(() => {
    if (!loading && !allowed && !deniedToastShownRef.current) {
      deniedToastShownRef.current = true;
      toast.error('Você não tem permissão para acessar esta área.');
    }
  }, [loading, allowed]);

  if (loading) return null;
  if (!allowed) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default DashboardRouteGuard;
