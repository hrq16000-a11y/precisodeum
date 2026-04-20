import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Loader2, MessageCircle, Mail } from 'lucide-react';

type WhatsAppTarget = {
  url: string;
  targetType?: 'provider' | 'sponsor' | 'job' | 'support';
  targetId?: string | null;
  targetLabel?: string | null;
  whatsappNumber?: string | null;
};

interface Ctx {
  /** Open WhatsApp link, gating with login modal if user is anonymous */
  requestWhatsApp: (target: WhatsAppTarget) => void;
}

const PENDING_KEY = 'wa_gate_pending_v1';
const TERMS_URL = 'https://precisodeumprofissional.com.br/regras-de-atendimento';

const GateContext = createContext<Ctx>({ requestWhatsApp: () => {} });

const openExternal = (url: string) => {
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    window.location.href = url;
  }
};

const recordLead = async (
  user: { id: string; email?: string | null } | null,
  target: WhatsAppTarget,
  agreedTerms: boolean,
) => {
  if (!user) return;
  try {
    await supabase.from('lead_contacts').insert({
      user_id: user.id,
      email: user.email ?? null,
      target_type: target.targetType ?? 'provider',
      target_id: target.targetId ?? null,
      target_label: target.targetLabel ?? null,
      page_path: typeof window !== 'undefined' ? window.location.pathname : null,
      whatsapp_number: target.whatsappNumber ?? null,
      agreed_terms: agreedTerms,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 255) : null,
    });
  } catch {
    /* silent — tracking must never block UX */
  }
};

export const WhatsAppGateProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef<WhatsAppTarget | null>(null);

  // Load any pending intent stored before an OAuth redirect
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (raw) pendingRef.current = JSON.parse(raw);
    } catch {/* ignore */}
  }, []);

  // After authentication completes, fire the pending WhatsApp intent
  useEffect(() => {
    if (!user) return;
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    try { localStorage.removeItem(PENDING_KEY); } catch {/* ignore */}
    void recordLead({ id: user.id, email: user.email }, pending, true);
    // Slight delay so any auth UI settles
    setTimeout(() => openExternal(pending.url), 150);
    setOpen(false);
  }, [user]);

  const requestWhatsApp = useCallback((target: WhatsAppTarget) => {
    if (user) {
      // Logged in: silent track + open immediately
      void recordLead({ id: user.id, email: user.email }, target, true);
      openExternal(target.url);
      return;
    }
    // Anonymous: persist intent and open gate modal
    pendingRef.current = target;
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(target)); } catch {/* ignore */}
    setAgreed(false);
    setEmail('');
    setPassword('');
    setFullName('');
    setTab('login');
    setOpen(true);
  }, [user]);

  const handleGoogle = async () => {
    if (!agreed) {
      toast({ title: 'Aceite as regras', description: 'É necessário concordar com as regras de atendimento.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.href,
      });
      if (result.error) {
        toast({ title: 'Erro no login', description: 'Tente novamente.', variant: 'destructive' });
      }
      // If redirected, browser will navigate away; intent stays in localStorage.
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast({ title: 'Aceite as regras', description: 'É necessário concordar com as regras de atendimento.', variant: 'destructive' });
      return;
    }
    if (!email || !password || (tab === 'signup' && !fullName)) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      if (tab === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.href,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast({ title: 'Cadastro criado', description: 'Verifique seu e-mail se pedido. Liberando contato...' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      // Auto-fire happens in useEffect when `user` is populated.
    } catch (err: any) {
      toast({ title: 'Não foi possível continuar', description: err?.message ?? 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GateContext.Provider value={{ requestWhatsApp }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Liberar contato no WhatsApp
            </DialogTitle>
            <DialogDescription>
              Para falar com o profissional, faça login ou cadastre-se. É rápido e garante a segurança da negociação.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-3 pt-3">
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="wa-email">E-mail</Label>
                  <Input id="wa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wa-password">Senha</Label>
                  <Input id="wa-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4 mr-1" /> Entrar e liberar</>}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-3 pt-3">
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="wa-name">Nome completo</Label>
                  <Input id="wa-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wa-email-s">E-mail</Label>
                  <Input id="wa-email-s" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wa-password-s">Senha</Label>
                  <Input id="wa-password-s" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4 mr-1" /> Cadastrar e liberar</>}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">ou</span></div>
          </div>

          <Button variant="outline" type="button" onClick={handleGoogle} disabled={submitting} className="w-full">
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Continuar com Google
          </Button>

          <label className="flex items-start gap-2 text-sm pt-1 cursor-pointer">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
            <span className="text-muted-foreground leading-snug">
              Concordo com as{' '}
              <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                regras de atendimento
              </a>.
            </span>
          </label>

          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Esqueceu a senha?{' '}
            <button type="button" className="underline" onClick={() => { setOpen(false); navigate('/login'); }}>
              Recuperar
            </button>
          </p>
        </DialogContent>
      </Dialog>
    </GateContext.Provider>
  );
};

export const useWhatsAppGate = () => useContext(GateContext);

/** Identify a click target as a WhatsApp link */
const isWhatsAppHref = (href: string | null | undefined): boolean => {
  if (!href) return false;
  return href.startsWith('https://wa.me/') || href.startsWith('http://wa.me/') || href.startsWith('whatsapp://');
};

/**
 * Global click interceptor — captures any anchor with a WhatsApp URL
 * and routes it through the gate. Allows opt-out via `data-wa-skip`.
 */
export const WhatsAppGateInterceptor = () => {
  const { requestWhatsApp } = useWhatsAppGate();

  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      // Ignore non-primary clicks / modifier clicks (let user open in new tab)
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

      const path = (ev.composedPath?.() ?? []) as Element[];
      const anchor = path.find((el) => el && (el as HTMLElement).tagName === 'A') as HTMLAnchorElement | undefined;
      if (!anchor) return;
      if (anchor.dataset.waSkip === 'true') return;

      const href = anchor.getAttribute('href');
      if (!isWhatsAppHref(href)) return;

      ev.preventDefault();
      ev.stopPropagation();

      const targetType = (anchor.dataset.waTargetType as any) || 'provider';
      const targetId = anchor.dataset.waTargetId || null;
      const targetLabel = anchor.dataset.waTargetLabel || anchor.textContent?.trim().slice(0, 120) || null;

      // Extract phone for tracking
      let whatsappNumber: string | null = null;
      try {
        const u = new URL(href!.startsWith('whatsapp://') ? href!.replace('whatsapp://send', 'https://wa.me/dummy') : href!);
        const m = href!.match(/wa\.me\/(\d+)/);
        if (m) whatsappNumber = m[1];
        else whatsappNumber = u.searchParams.get('phone');
      } catch {/* ignore */}

      requestWhatsApp({
        url: href!,
        targetType,
        targetId,
        targetLabel,
        whatsappNumber,
      });
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [requestWhatsApp]);

  return null;
};
