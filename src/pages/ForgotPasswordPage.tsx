import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft, Clock } from 'lucide-react';
import {
  startCooldown as startCooldownShared,
  subscribeCooldown,
  formatCooldown,
} from '@/lib/forgotPasswordCooldown';

type Status = 'idle' | 'sending' | 'sent' | 'cooldown' | 'not_found' | 'error';

const COOLDOWN_SECONDS = 60;

const ForgotPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialEmail = (location.state as any)?.email || '';
  const [email, setEmail] = useState<string>(initialEmail);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');
  const [cooldown, setCooldown] = useState<number>(0);

  useEffect(() => {
    document.title = 'Esqueci minha senha | Preciso de Um';
    // Sincroniza cooldown entre abas via BroadcastChannel + storage events
    const unsub = subscribeCooldown((remaining) => setCooldown(remaining));
    return unsub;
  }, []);

  const startCooldown = (seconds: number) => {
    startCooldownShared(seconds);
    // estado local será atualizado pelo subscribeCooldown; setamos imediato pra UX
    setCooldown((prev) => Math.max(prev, seconds));
  };

  const validate = (raw: string): string | null => {
    const v = raw.trim();
    if (!v) return 'Digite seu e-mail.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Formato de e-mail inválido.';
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) {
      setStatus('cooldown');
      setMessage(`Aguarde ${formatCooldown(cooldown)} antes de pedir um novo e-mail.`);
      return;
    }
    const err = validate(email);
    if (err) {
      setStatus('error');
      setMessage(err);
      return;
    }
    setStatus('sending');
    setMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (/rate|too.?many|over.?email.?send/.test(msg)) {
        setStatus('cooldown');
        setMessage('Muitos pedidos seguidos. Tente novamente em alguns minutos.');
        startCooldown(COOLDOWN_SECONDS * 2);
        toast.error('Muitos pedidos seguidos. Aguarde alguns minutos.');
        return;
      }
      if (/user.?not.?found|no.?such.?user|invalid.?email/.test(msg)) {
        setStatus('not_found');
        setMessage('Se este e-mail estiver cadastrado, você receberá um link de redefinição em instantes. Verifique também a caixa de spam.');
        startCooldown(COOLDOWN_SECONDS);
        return;
      }
      setStatus('error');
      setMessage('Não foi possível enviar o e-mail agora. Tente novamente em instantes.');
      toast.error('Erro ao enviar e-mail de recuperação.');
      return;
    }
    setStatus('sent');
    setMessage('Enviamos um link de redefinição para seu e-mail. O link expira em 1 hora.');
    startCooldown(COOLDOWN_SECONDS);
    toast.success('Link de recuperação enviado!');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-border bg-card p-8 shadow-card">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-foreground">Esqueci minha senha</h1>
                <p className="text-xs text-muted-foreground">Enviaremos um link seguro para redefinir sua senha.</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="mb-1 block text-sm font-medium text-foreground">
                  E-mail cadastrado
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-describedby="forgot-help"
                />
                <p id="forgot-help" className="mt-1 text-[11px] text-muted-foreground">
                  Use o mesmo e-mail que você usa para entrar na plataforma.
                </p>
              </div>

              <Button
                type="submit"
                variant="accent"
                className="w-full"
                disabled={status === 'sending' || cooldown > 0}
              >
                {status === 'sending' && 'Enviando...'}
                {cooldown > 0 && status !== 'sending' && (
                  <span className="inline-flex items-center gap-1.5" aria-live="polite">
                    <Clock className="h-4 w-4" /> Reenviar em {formatCooldown(cooldown)}
                  </span>
                )}
                {cooldown === 0 && status !== 'sending' && 'Enviar link de redefinição'}
              </Button>

              {(status === 'sent' || status === 'not_found') && (
                <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-[13px] text-emerald-700 dark:text-emerald-300" role="status" aria-live="polite">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{message}</p>
                </div>
              )}
              {status === 'cooldown' && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-amber-700 dark:text-amber-300" role="alert" aria-live="polite">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{message || 'Já existe uma redefinição em andamento. Aguarde alguns instantes antes de tentar novamente.'}</p>
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-[13px] text-destructive" role="alert" aria-live="assertive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{message}</p>
                </div>
              )}
            </form>

            <div className="mt-6 flex items-center justify-between text-xs">
              <Link to="/login" className="inline-flex items-center gap-1 text-accent hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
              </Link>
              <button
                type="button"
                onClick={() => navigate('/ajuda')}
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                Falar com o suporte
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Por segurança, não confirmamos publicamente se um e-mail está cadastrado.
            Se o seu estiver, o link chegará em até 1 minuto.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ForgotPasswordPage;
