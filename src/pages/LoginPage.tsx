import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import AuthPageShell from '@/components/auth/AuthPageShell';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import { useSeoHead } from '@/hooks/useSeoHead';
import { resolvePostLoginRoute } from '@/lib/onboardingAccess';
import PasswordInput from '@/components/auth/PasswordInput';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';

const GoogleIcon = () => (
  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

type GoogleState = 'idle' | 'loading' | 'redirecting' | 'success' | 'error';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [googleState, setGoogleState] = useState<GoogleState>('idle');
  const [googleError, setGoogleError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading } = useAuth();
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);

  // Mantemos a rota salva apenas para jornadas futuras; o pós-auth cai sempre no V3 (/cadastro-bet).
  const from = (location.state as any)?.from || null;

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;
    let fallbackTimer: number | null = null;

    // Caminho feliz: profile carregado → resolve rota normalmente.
    if (profile) {
      void (async () => {
        const fallbackAuthorizedRoute = typeof from === 'string' && from.startsWith('/')
          ? from
          : '/dashboard';

        const nextRoute = await resolvePostLoginRoute({
          userId: user.id,
          profile,
          fallbackAuthorizedRoute,
        });

        if (cancelled) return;
        navigate(nextRoute, { replace: true, state: from ? { from } : undefined });
      })();
    } else {
      // Fallback: usuário autenticado mas profile ainda não chegou (race do
      // trigger handle_new_user, RLS, rede lenta). Após 3s, manda pro
      // /cadastro-inicial que faz seu próprio gate e não deixa o usuário
      // preso na tela de login mostrando "Bem-vindo(a)!" indefinidamente.
      fallbackTimer = window.setTimeout(() => {
        if (cancelled) return;
        navigate('/cadastro-inicial', { replace: true, state: from ? { from } : undefined });
      }, 3000);
    }

    return () => {
      cancelled = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
    };
  }, [user, profile, authLoading, from, navigate]);

  useSeoHead({ title: 'Entrar', description: 'Acesse a plataforma Preciso de um.', noindex: true });

  /**
   * Porta única: tenta login. Se a conta não existir, cria silenciosamente.
   * Em ambos os casos, o Hard Gate /cadastro-bet (V3) assume daqui.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setEmailError('Informe seu e-mail.');
      return;
    }
    if (!password) {
      setPasswordError('Informe sua senha.');
      return;
    }
    // Validação local antes de bater no servidor — evita mensagens genéricas
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Digite um e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setPasswordError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);

    try {
      const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (!signInError && signInData.session) {
        if (import.meta.env.DEV) {
          console.info('[login][diag] signIn OK', {
            user_id: signInData.user?.id,
            has_session: !!signInData.session,
          });
        }
        // Navegação explícita imediata: não dependemos só do useEffect/onAuthStateChange.
        // /cadastro-inicial tem seu próprio gate que decide o destino final.
        toast.success('Bem-vindo(a)!');
        navigate('/cadastro-inicial', { replace: true, state: from ? { from } : undefined });
        return;
      }

      if (import.meta.env.DEV && signInError) {
        const status = (signInError as any)?.status;
        const code = status === 403 ? 'C_RLS_403' : 'A_AUTH_FAIL';
        console.warn('[login][diag] signIn failed', {
          category: code,
          status,
          message: signInError.message,
        });
      }

      const errMsg = signInError?.message || '';

      // E-mail não confirmado → orientar verificação
      if (/email.*not.*confirmed|email_not_confirmed/i.test(errMsg)) {
        toast.error('Confirme seu e-mail antes de entrar. Enviamos o link na criação da conta.');
        return;
      }

      // Conta não existe → cria silenciosamente (porta única)
      const looksLikeNoAccount = signInError && /invalid login credentials|invalid_grant|user not found/i.test(errMsg);

      if (looksLikeNoAccount) {
        // Bloqueio de reentrada (180 dias) — verifica antes de tentar criar a conta.
        try {
          const deviceFp = await getDeviceFingerprint();
          const { data: blockData } = await (supabase.rpc as any)('check_registration_block', {
            _email: trimmedEmail,
            _whatsapp: null,
            _device_fingerprint: deviceFp,
          });
          const block = (blockData as any) || {};
          if (block?.blocked) {
            const days =
              typeof block.days_remaining === "number" ? block.days_remaining : null;
            const reasonRaw =
              typeof block.reason === "string" && block.reason ? block.reason : null;
            const matchedVia =
              typeof block.matched_via === "string" ? block.matched_via : "unknown";
            const expiresAt =
              typeof block.expires_at === "string" ? block.expires_at : null;
            const isPermanent = block.permanent === true;

            const vector =
              matchedVia === "email"
                ? "este e-mail"
                : matchedVia === "whatsapp"
                  ? "este WhatsApp"
                  : matchedVia === "device"
                    ? "este dispositivo"
                    : "este e-mail, WhatsApp ou dispositivo";

            const reasonHuman =
              reasonRaw === "self_deletion_180d"
                ? "exclusão voluntária de conta (LGPD)"
                : reasonRaw === "policy_violation"
                  ? "violação dos termos de uso"
                  : reasonRaw || "política de uso";

            let when = "";
            if (isPermanent) {
              when = " O bloqueio é permanente.";
            } else if (expiresAt) {
              try {
                const dt = new Date(expiresAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                });
                when = ` Você poderá criar uma nova conta a partir de ${dt}${
                  days != null ? ` (em ${days} dia${days === 1 ? "" : "s"})` : ""
                }.`;
              } catch {
                if (days != null) {
                  when = ` Você poderá criar uma nova conta em ${days} dia${days === 1 ? "" : "s"}.`;
                }
              }
            } else if (days != null) {
              when = ` Você poderá criar uma nova conta em ${days} dia${days === 1 ? "" : "s"}.`;
            }

            const instructions = isPermanent
              ? " Se acreditar que isso é um engano, entre em contato pelo /ajuda."
              : " Enquanto isso, você pode entrar em contato pelo /ajuda em caso de dúvidas ou esperar o prazo expirar.";

            toast.error(
              `Por política de uso (LGPD), ${vector} está temporariamente impedido de criar nova conta.${when} Motivo: ${reasonHuman}.${instructions}`,
              { duration: 12000 },
            );
            return;
          }
        } catch (e) {
          // RPC indisponível → fail-open intencional
          console.warn('[reentry-check] skipped:', e);
        }

        const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/cadastro-inicial` },
        });
        if (signUpError) {
          const m = signUpError.message || '';
          if (/already.*registered|user.*already.*exists|already_registered/i.test(m)) {
            // PATH 7: e-mail já cadastrado — inline, sem abrir dialog automaticamente
            setEmailError('Este e-mail já possui conta. Use sua senha ou clique em "Esqueci minha senha".');
            emailRef.current?.focus();
            return;
          }
          if (/password.*(short|6 characters)|weak_password|pwned|weak/i.test(m)) {
            toast.error('Escolha uma senha mais forte. Evite sequências fáceis e combinações comuns.');
            return;
          }
          if (/rate limit|too many/i.test(m)) {
            toast.error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
            return;
          }
          if (/invalid.*email|validate email|invalid.*format/i.test(m)) {
            setEmailError('E-mail inválido.');
            toast.error('E-mail inválido.');
            return;
          }
          toast.error('Não foi possível criar sua conta. Tente novamente em instantes.');
          return;
        }
        // Heurística: identities=[] indica e-mail já existente
        const identities = (signUpData.user as any)?.identities;
        if (Array.isArray(identities) && identities.length === 0) {
          // PATH 7 (heurística): inline, sem abrir dialog automaticamente
          setEmailError('Este e-mail já possui conta. Use sua senha ou clique em "Esqueci minha senha".');
          emailRef.current?.focus();
          return;
        }
        if (signUpData.session) {
          toast.success('Conta criada! Vamos configurar seu perfil.');
          navigate('/cadastro-inicial', { replace: true, state: from ? { from } : undefined });
        } else {
          toast.success('Conta criada! Verifique seu e-mail para confirmar e depois faça login.');
        }
        return;
      }

      // Erros mais explícitos para outros casos
      if (/rate limit|too many/i.test(errMsg)) {
        toast.error('Muitas tentativas de login. Aguarde alguns minutos.');
      } else {
        // PATH 3: senha incorreta — inline + foco no campo senha (sem dialog automático)
        setPasswordError('E-mail ou senha inválidos.');
        passwordRef.current?.focus();
      }
    } catch (err: any) {
      // Falha de rede ou exceção inesperada — não deixa o botão travado
      console.error('[login] unexpected error:', err);
      toast.error('Erro inesperado. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (forceFreshChooser = false) => {
    if (from) sessionStorage.setItem('auth_redirect', from);
    setGoogleError(null);
    setGoogleState('loading');
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
        // Se já falhou uma vez, força tela de seleção de conta
        extraParams: { prompt: forceFreshChooser ? 'select_account consent' : 'select_account' },
      });
      if ((result as any).redirected) {
        setGoogleState('redirecting');
        return; // navegador já saiu da página
      }
      if ((result as any).error) {
        const msg = (result as any).error?.message || 'Falha ao continuar com Google';
        setGoogleError(msg);
        setGoogleState('error');
        setLoading(false);
        toast.error('Não foi possível entrar com Google. Tente trocar de conta.');
        return;
      }
      setGoogleState('success');
    } catch (err: any) {
      setGoogleError(err?.message || 'Erro inesperado no login Google');
      setGoogleState('error');
      setLoading(false);
      toast.error('Erro inesperado no login Google');
    }
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
    <AuthPageShell backTo="/" backLabel="Voltar ao início">
      <div className="flex w-full items-center justify-center py-6 relative overflow-hidden">
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
              className="mt-6 w-full text-base py-5 font-semibold shadow-md disabled:opacity-70"
              onClick={() => handleGoogleLogin(false)}
              disabled={googleState === 'loading' || googleState === 'redirecting'}
              aria-busy={googleState === 'loading' || googleState === 'redirecting'}
            >
              <GoogleIcon />
              {googleState === 'loading' && 'Conectando...'}
              {googleState === 'redirecting' && 'Redirecionando para o Google...'}
              {googleState === 'success' && 'Conectado!'}
              {(googleState === 'idle' || googleState === 'error') && 'Continuar com Google'}
            </Button>
            {googleState === 'error' ? (
              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-[12px] text-destructive">
                <p className="font-semibold">Não foi possível entrar com Google.</p>
                {googleError && <p className="mt-0.5 break-words text-[11px] opacity-80">{googleError}</p>}
                <button
                  type="button"
                  onClick={() => handleGoogleLogin(true)}
                  className="mt-2 inline-block text-[11px] font-semibold underline"
                >
                  Tentar trocar de conta Google
                </button>
              </div>
            ) : (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Rápido, seguro e sem precisar de senha
              </p>
            )}

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
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? 'login-email-error' : undefined}
                      className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground ${emailError ? 'border-destructive focus:outline-none focus:ring-1 focus:ring-destructive' : 'border-input'}`}
                    />
                    {emailError && (
                      <p id="login-email-error" className="mt-1 text-xs text-destructive">{emailError}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Senha</label>
                    <PasswordInput
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(null); }}
                      autoComplete="current-password"
                      showRules
                      aria-invalid={!!passwordError}
                      aria-describedby={passwordError ? 'login-password-error' : undefined}
                    />
                    {passwordError && (
                      <p id="login-password-error" className="mt-1 text-xs text-destructive">{passwordError}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <button type="button" onClick={() => navigate('/esqueci-senha', { state: { email } })}
                      className="text-xs text-accent hover:underline">
                      Esqueci minha senha
                    </button>
                  </div>
                  <Button type="submit" variant="outline" className="w-full" disabled={loading} aria-busy={loading}>
                    {loading ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Processando...
                      </span>
                    ) : 'Continuar'}
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
    </AuthPageShell>
  );
};

export default LoginPage;
