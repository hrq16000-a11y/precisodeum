/**
 * AdminGuard — Wrapper centralizado para rotas /admin/*.
 *
 * Camadas de proteção:
 *  1. Auth obrigatória (redireciona p/ /login se não logado)
 *  2. Verificação server-side via RPC `has_role(_user_id, 'admin')`
 *  3. Negação default: enquanto a checagem não retorna, NADA é renderizado
 *  4. Usuários comuns são redirecionados para /dashboard com toast
 *
 * NUNCA confie em flag client-side ou localStorage para gating de admin.
 */
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminGuardProps {
  children: React.ReactNode;
  /** Mensagem opcional a exibir caso o usuário comum tente acessar */
  denyToast?: string;
}

const AdminGuard = ({ children, denyToast }: AdminGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let cancelled = false;

    if (authLoading) {
      return () => { cancelled = true; };
    }

    if (!user) {
      if (!cancelled) setState('denied');
      return () => { cancelled = true; };
    }

    void (async () => {
      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin',
        });
        if (cancelled) return;
        if (error || !data) {
          setState('denied');
          toast.error(denyToast || 'Acesso restrito ao painel administrativo.');
          return;
        }
        setState('allowed');
      } catch (err) {
        if (cancelled) return;
        console.error('[AdminGuard] has_role check failed:', err);
        setState('denied');
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading, denyToast]);

  if (authLoading || state === 'checking') {
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

  if (state === 'denied') {
    if (!user) {
      return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AdminGuard;
