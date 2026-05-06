import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import { useSeoHead } from '@/hooks/useSeoHead';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const navigate = useNavigate();

  useSeoHead({ title: 'Entrar', description: 'Faça login na plataforma Preciso de um.', noindex: true });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error('E-mail ou senha inválidos');
    } else if (data.session) {
      toast.success('Login realizado com sucesso!');
      // Smart redirect based on profile type
      setTimeout(async () => {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('profile_type')
            .eq('id', data.session!.user.id)
            .single();
          const type = prof?.profile_type || 'client';
          if (type === 'client') {
            navigate('/', { replace: true });
          } else if (type === 'rh') {
            navigate('/dashboard/vagas', { replace: true });
          } else {
            navigate('/dashboard/servicos', { replace: true });
          }
        } catch {
          navigate('/dashboard', { replace: true });
        }
      }, 100);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin + '/dashboard',
    });
    if (error) toast.error('Erro ao fazer login com Google');
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
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-border bg-card p-8 shadow-card">
            <h1 className="text-center font-display text-2xl font-bold text-foreground">Entrar</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">Acesse sua conta</p>

            <Button variant="outline" className="mt-6 w-full" onClick={handleGoogleLogin}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Entrar com Google
            </Button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
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
                  Voltar ao login
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
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                  <div className="text-right">
                    <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); }}
                      className="text-xs text-accent hover:underline">
                      Esqueci minha senha
                    </button>
                  </div>
                  <Button type="submit" variant="accent" className="w-full" disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </form>

                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Não tem conta? <Link to="/cadastro" className="font-medium text-accent hover:underline">Cadastre-se</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default LoginPage;
