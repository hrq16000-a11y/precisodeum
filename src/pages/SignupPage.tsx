import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import { trackAction } from '@/lib/errorReporter';
import { showSaveError } from '@/components/SaveErrorToast';
import { useSeoHead } from '@/hooks/useSeoHead';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const SignupPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');
  const { user: authUser, loading: authLoading } = useAuth();

  // Persist referral code so it survives OAuth redirect / email confirmation
  useEffect(() => {
    if (refCode) {
      try { sessionStorage.setItem('pending_referral_code', refCode.toUpperCase()); } catch {}
    }
  }, [refCode]);

  useSeoHead({ title: 'Criar Conta', description: 'Crie sua conta gratuita em segundos.', noindex: true });

  // Redirect already-authenticated users straight to dashboard (triagem decide o resto)
  useEffect(() => {
    if (authLoading || !authUser) return;
    navigate('/dashboard', { replace: true });
  }, [authUser, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Preencha e-mail e senha');
      return;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    trackAction('signup_start', 'email_password');
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already')) {
        toast.error('Este e-mail já está cadastrado. Tente fazer login.');
      } else {
        await showSaveError({
          actionContext: 'Cadastro de conta',
          componentName: 'SignupPage',
          errorMessage: error.message,
        });
      }
      setLoading(false);
      return;
    }
    setLoading(false);

    // Register P2P referral if a code was provided in URL
    const code = refCode || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pending_referral_code') : null);
    if (code) {
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser?.id) {
        await (supabase as any).rpc('register_referral', { _referred_id: newUser.id, _referral_code: code });
        try { sessionStorage.removeItem('pending_referral_code'); } catch {}
      }
    }

    toast.success('Conta criada! Vamos personalizar sua experiência.', { duration: 4000 });
    navigate('/dashboard', { replace: true });
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error('Erro ao cadastrar com Google');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 items-center justify-center py-8 px-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border/50 bg-card/90 backdrop-blur-xl p-6 sm:p-8 shadow-xl">
            <h1 className="text-center font-display text-2xl sm:text-3xl font-bold text-foreground">
              Criar Conta
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              É grátis e leva menos de 30 segundos
            </p>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background hover:bg-muted px-4 py-3 text-sm font-semibold text-foreground transition-all hover:shadow-md disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continuar com Google
            </button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Email + Password */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-foreground">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-foreground">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="accent"
                className="w-full"
                disabled={loading || googleLoading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  'Criar conta grátis'
                )}
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Ao continuar, você concorda com nossos{' '}
              <Link to="/termos" className="underline hover:text-foreground">Termos</Link> e{' '}
              <Link to="/privacidade" className="underline hover:text-foreground">Privacidade</Link>.
            </p>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Já tem conta?{' '}
              <Link to="/login" className="font-semibold text-accent hover:underline">
                Entrar
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SignupPage;
