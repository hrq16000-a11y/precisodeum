import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import { useSeoHead } from '@/hooks/useSeoHead';

const GoogleIcon = () => (
  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading } = useAuth();

  // Get the URL to redirect back to after login
  const from = (location.state as any)?.from || null;

  // Se já autenticado: triagem (sem profile_type) ou destino real.
  useEffect(() => {
    if (authLoading || !user) return;
    if (profile && !profile.profile_type) {
      navigate('/triagem', { replace: true });
      return;
    }
    if (profile?.profile_type) {
      navigate(from || '/dashboard', { replace: true });
    }
  }, [user, profile, authLoading, from, navigate]);

  useSeoHead({ title: 'Entrar', description: 'Acesse a plataforma Preciso de um.', noindex: true });

  /**
   * Porta única: tenta login. Se a conta não existir, cria silenciosamente.
   * Em ambos os casos, o Hard Gate /triagem assume daqui.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({ email, password });

    if (!signInError && signInData.session) {
      setLoading(false);
      toast.success('Bem-vindo(a)!');
      // Redirect handled by useEffect above (após profile carregar)
      return;
    }

    // Conta não existe → cria silenciosamente (porta única).
    const looksLikeNoAccount =
      signInError && /invalid login credentials|invalid_grant|user not found/i.test(signInError.message);

    if (looksLikeNoAccount) {
      const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/triagem` },
      });
      setLoading(false);
      if (signUpError) {
        toast.error('Não foi possível criar sua conta. Verifique o e-mail/senha.');
        return;
      }
      if (signUpData.session) {
        toast.success('Conta criada! Vamos configurar seu perfil.');
        // useEffect redireciona para /triagem automaticamente
      } else {
        toast.success('Conta criada! Verifique seu e-mail para confirmar.');
      }
      return;
    }

    setLoading(false);
    toast.error('E-mail ou senha inválidos.');
  };

  const handleGoogleLogin = async () => {
    if (from) sessionStorage.setItem('auth_redirect', from);
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error('Erro ao continuar com Google');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('Digite seu e-mail');
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast.error('Erro ao enviar e-mail de recuperação');
    } else {
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setShowForgot(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 items-center justify-center py-12 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
        
        <motion.div
          className="w-full max-w-sm relative px-4"
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="rounded-xl border border-border bg-card p-8 shadow-card relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent/40 to-transparent shimmer" />
            
            <motion.h1
              className="text-center font-display text-2xl font-bold text-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >Acessar a plataforma</motion.h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">Entre ou crie sua conta em segundos</p>

            {/* Google as primary CTA */}
            <Button
              variant="accent"
              className="mt-6 w-full text-base py-5 font-semibold shadow-md"
              onClick={handleGoogleLogin}
            >
              <GoogleIcon />
              Continuar com Google
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Rápido, seguro e sem precisar de senha
            </p>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou use e-mail</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {showForgot ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-muted-foreground">Digite seu e-mail para receber o link de recuperação de senha.</p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">E-mail</label>
                  <input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                </div>
                <Button type="submit" variant="accent" className="w-full" disabled={forgotLoading}>
                  {forgotLoading ? 'Enviando...' : 'Enviar link de recuperação'}
                </Button>
                <button type="button" onClick={() => setShowForgot(false)}
                  className="w-full text-center text-sm text-accent hover:underline">
                  Voltar
                </button>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">E-mail</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Senha</label>
                    <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                  <div className="text-right">
                    <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); }}
                      className="text-xs text-accent hover:underline">
                      Esqueci minha senha
                    </button>
                  </div>
                  <Button type="submit" variant="outline" className="w-full" disabled={loading}>
                    {loading ? 'Processando...' : 'Continuar'}
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Se você ainda não tem conta, criamos uma automaticamente.
                  </p>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default LoginPage;
