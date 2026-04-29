import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildLoginUrl, sanitizeNextPath } from '@/lib/authRedirect';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [statusMessage, setStatusMessage] = useState('Verificando link de recuperação...');
  const navigate = useNavigate();
  const location = useLocation();

  const successLoginUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const next = sanitizeNextPath(params.get('next'), '/dashboard');
    const message = params.get('message') || 'Senha atualizada com sucesso. Entre novamente para continuar.';
    return buildLoginUrl(next, message, window.location.origin);
  }, [location.search]);

  useEffect(() => {
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.replace(/^#/, ''));

    if (hashParams.get('error') || hashParams.get('error_code')) {
      setStatus('invalid');
      setStatusMessage('Este link de redefinição expirou ou não é mais válido. Peça um novo link para continuar.');
      return;
    }

    let timeoutId = window.setTimeout(() => {
      setStatus('invalid');
      setStatusMessage('Este link de redefinição expirou ou não é mais válido. Peça um novo link para continuar.');
    }, 1800);

    const markReady = () => {
      window.clearTimeout(timeoutId);
      setStatus('ready');
      setStatusMessage('Digite sua nova senha abaixo.');
    };

    if (hash.includes('type=recovery')) {
      markReady();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') markReady();
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session && hash.includes('type=recovery')) {
        markReady();
      }
    });

    return () => {
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
      if (error) {
        const raw = error.message || '';
        if (/expired|invalid|token|otp/i.test(raw)) {
          setStatus('invalid');
          setStatusMessage('Este link de redefinição expirou ou não é mais válido. Peça um novo link para continuar.');
          toast.error('O link de redefinição expirou ou é inválido.');
          return;
        }
        toast.error('Erro ao redefinir senha: ' + raw);
    } else {
        try { await supabase.auth.signOut(); } catch { /* noop */ }
        toast.success('Senha redefinida com sucesso!');
        navigate(`/senha-redefinida${successLoginUrl.replace('/login', '')}`, { replace: true });
      }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-border bg-card p-8 shadow-card">
            <h1 className="text-center font-display text-2xl font-bold text-foreground">Redefinir Senha</h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">{statusMessage}</p>

             {status === 'ready' ? (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Nova senha</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Confirmar senha</label>
                  <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                </div>
                <Button type="submit" variant="accent" className="w-full" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar nova senha'}
                </Button>
              </form>
             ) : (
               <div className="mt-6 space-y-3 text-center text-sm text-muted-foreground">
                 <p>Se o link expirou, volte ao login e peça um novo e-mail de redefinição.</p>
                 <a href={successLoginUrl} className="text-accent hover:underline">Ir para o login</a>
               </div>
             )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ResetPasswordPage;
