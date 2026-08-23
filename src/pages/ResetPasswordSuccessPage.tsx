import { useEffect, useMemo } from 'react';
import { Link, useLocation } from '@/lib/router-compat';
import { CheckCircle2, LogIn, ShieldCheck, ArrowRight } from 'lucide-react';
import AuthPageShell from '@/components/auth/AuthPageShell';
import { Button } from '@/components/ui/button';
import { buildLoginUrl, sanitizeNextPath } from '@/lib/authRedirect';

const ResetPasswordSuccessPage = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = 'Senha redefinida com sucesso | Preciso de Um';
  }, []);

  const loginHref = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return buildLoginUrl(
      sanitizeNextPath(params.get('next'), '/dashboard'),
      params.get('message') || 'Senha atualizada com sucesso. Faça login para continuar.',
      window.location.origin,
    );
  }, [location.search]);

  return (
    <AuthPageShell backTo="/login" backLabel="Voltar ao login">
      <main className="flex w-full items-center justify-center px-0 py-2">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-card text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" aria-hidden="true" />
            </div>
            <h1 className="mt-5 font-display text-2xl font-bold text-foreground">
              Senha redefinida com sucesso!
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sua nova senha já está ativa. Agora é só entrar para continuar usando a plataforma.
            </p>

            <ul className="mt-6 space-y-2 text-left text-[13px] text-muted-foreground">
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>Por segurança, todas as sessões antigas foram encerradas.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>Você pode entrar com sua nova senha em qualquer dispositivo.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>Se não foi você quem redefiniu, fale com o suporte imediatamente.</span>
              </li>
            </ul>

            <div className="mt-7 grid gap-2">
              <Link to={loginHref}>
                <Button variant="accent" className="w-full">
                  <LogIn className="mr-2 h-4 w-4" /> Ir para o login
                </Button>
              </Link>
              <Link
                to="/ajuda"
                className="text-xs text-muted-foreground hover:text-foreground hover:underline inline-flex items-center justify-center gap-1"
              >
                Precisa de ajuda? Falar com o suporte <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </AuthPageShell>
  );
};

export default ResetPasswordSuccessPage;
