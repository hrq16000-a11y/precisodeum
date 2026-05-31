/**
 * AdminGuard — Wrapper centralizado para rotas /admin/*.
 *
 * Camadas de proteção:
 *  1. Auth obrigatória (redireciona p/ /login se não logado)
 *  2. Verificação server-side via RPC `has_role(_user_id, 'admin')`
 *     — cache de 5min via React Query (queryKey por user.id) evita
 *     N chamadas ao navegar entre rotas /admin/*.
 *  3. Negação default: enquanto a checagem não retorna, NADA é renderizado
 *  4. Usuários comuns são redirecionados para /dashboard com toast
 *
 * NUNCA confie em flag client-side ou localStorage para gating de admin.
 */
import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
// PR 4 (A3): usa apenas identidade — não re-renderiza quando profile/provider mudam.
import { useAuthIdentity } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminGuardProps {
  children: React.ReactNode;
  /** Mensagem opcional a exibir caso o usuário comum tente acessar */
  denyToast?: string;
}

const AdminGuard = ({ children, denyToast }: AdminGuardProps) => {
  const { user, loading: authLoading } = useAuthIdentity();
  const location = useLocation();

  const { data: isAdmin, isLoading: roleLoading, isError } = useQuery({
    queryKey: ['admin-role-check', user?.id ?? null],
    enabled: !!user && !authLoading,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user!.id,
        _role: 'admin',
      });
      if (error) throw error;
      return !!data;
    },
    staleTime: 1000 * 60 * 5, // 5min — evita refetch em navegação intra-admin
    gcTime: 1000 * 60 * 30,
    retry: false,             // negação não deve retentar
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Toast só dispara uma vez por sessão de negação para não spammar ao navegar.
  const deniedToastShownRef = useRef(false);
  useEffect(() => {
    if (!authLoading && user && (isAdmin === false || isError) && !deniedToastShownRef.current) {
      deniedToastShownRef.current = true;
      toast.error(denyToast || 'Acesso restrito ao painel administrativo.');
    }
  }, [authLoading, user, isAdmin, isError, denyToast]);

  // 1) Auth ainda resolvendo OU checagem de role em voo → spinner.
  if (authLoading || (!!user && roleLoading)) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        <span>Verificando permissões...</span>
        <ShieldAlert className="ml-2 h-4 w-4 opacity-30" aria-hidden="true" />
      </div>
    );
  }

  // 2) Sem usuário → /login preservando origem.
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  // 3) Usuário logado mas sem role admin (ou erro na RPC) → /dashboard.
  if (isAdmin !== true) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
