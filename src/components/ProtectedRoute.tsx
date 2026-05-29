import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedTypes?: string[];
  requireAuth?: boolean;
}

/**
 * ProtectedRoute — handles AUTH and ROLE checks only.
 *
 * Refatorado para roteamento 100% declarativo:
 *  - Nada de `useEffect` + `navigate()` (causava 1 frame de UI montada antes do redirect).
 *  - Enquanto `loading === true` (auth ainda resolvendo), retorna spinner — nenhuma
 *    decisão de redirect é tomada com estado parcial.
 *  - Quando o acesso é negado, retorna `<Navigate replace />` imediatamente.
 *
 * O onboarding gate (must-complete-triage) continua sendo de responsabilidade
 * exclusiva do `OnboardingGate` em App.tsx.
 */
const ProtectedRoute = ({ children, allowedTypes, requireAuth = true }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // 1) Auth ainda resolvendo — nunca decide redirect.
  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Carregando sua sessão</span>
      </div>
    );
  }

  // 2) Auth obrigatória sem usuário — redireciona declarativamente.
  if (requireAuth && !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // 3) Usuário existe mas profile ainda carregando (caso transitório legítimo
  //    pós-signup): exibe skeleton sem decidir nada — o useAuth garante que
  //    `loading=false` só ocorre quando os dados estão prontos ou falharam.
  if (user && !profile) {
    return <ProfileLoadingFallback />;
  }


  // 4) Restrição de tipo de conta — redirect declarativo.
  if (allowedTypes && profile?.profile_type && !allowedTypes.includes(profile.profile_type)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
