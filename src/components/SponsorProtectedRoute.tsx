import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SponsorProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protege /sponsor-panel/*.
 *
 * Refatorado para roteamento declarativo (Navigate em vez de useEffect+navigate).
 * O `useEffect` que sobra é APENAS para a checagem assíncrona de role/sponsor
 * — ele não chama navigate em nenhum caminho; quem decide o destino é o JSX.
 */
const SponsorProtectedRoute = ({ children }: SponsorProtectedRouteProps) => {
  const { user, profile, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile || !profile.profile_type) {
      // Caminhos negados são resolvidos pelo JSX abaixo via <Navigate>.
      return;
    }

    let cancelled = false;
    Promise.all([
      supabase.from('sponsor_contacts' as any).select('id').eq('user_id', user.id).limit(1).maybeSingle(),
      supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
    ])
      .then(([contactRes, roleRes]) => {
        if (cancelled) return;
        const isSponsor = !!contactRes.data;
        const isAdmin = !!roleRes.data;
        setAllowed(isSponsor || isAdmin);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, profile, authLoading]);

  // 1) Auth ainda resolvendo.
  if (authLoading) {
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

  // 2) Sem usuário — redirect declarativo.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3) Perfil sem profile_type → fluxo de cadastro inicial.
  if (profile && !profile.profile_type) {
    return <Navigate to="/cadastro-inicial" replace />;
  }

  // 4) Profile ainda carregando — spinner.
  if (!profile || allowed === null) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Verificando permissões</span>
      </div>
    );
  }

  // 5) Não é sponsor nem admin — redirect declarativo.
  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default SponsorProtectedRoute;
