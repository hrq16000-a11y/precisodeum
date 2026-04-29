/**
 * GlobalExitIntentDialog — Pop-up de captação para TODA a plataforma.
 *
 * Diferente do `ExitIntentDialog` (escopo wizard), este é montado uma vez no
 * `App.tsx` e:
 *  - É suprimido em rotas internas (wizard, dashboard, admin, login, recuperação).
 *  - Lê cidade/bairro do `useGeoCity` para personalizar a mensagem.
 *  - Adapta a copy à página atual (home, busca, categoria, profissional, etc.).
 *  - Aparece uma única vez por sessão (sessionStorage `global-exit-intent:shown`).
 *  - É suprimido se o usuário já contatou suporte ou visitou /ajuda/cadastro
 *    (compartilha `shouldSuppressExitIntent` com o exit-intent do wizard).
 *
 * Telemetria: registra `global_exit_intent_*` em `track_event` para podermos
 * medir conversão por página de origem.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, UserPlus, Search, X, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGeoCity } from '@/hooks/useGeoCity';
import { markSupportContacted, shouldSuppressExitIntent } from '@/lib/conversionFunnel';

const STORAGE_KEY = 'global-exit-intent:shown';
const INACTIVITY_MS = 45_000;
const SUPPORT_WHATSAPP = '5541997452053';

// Rotas onde o pop-up NÃO deve aparecer (já há gatilhos de conversão próprios
// ou o usuário está dentro de fluxos transacionais).
const EXCLUDED_PREFIXES = [
  '/cadastro',
  '/onboarding',
  '/dashboard',
  '/admin',
  '/login',
  '/auth',
  '/sponsor',
  '/patrocinador',
  '/ajuda',
  '/recuperar',
];

type PageKind =
  | 'home'
  | 'busca'
  | 'categoria'
  | 'cidade'
  | 'profissional'
  | 'blog'
  | 'vagas'
  | 'cursos'
  | 'generic';

function detectPageKind(pathname: string): PageKind {
  if (pathname === '/' || pathname === '') return 'home';
  if (pathname.startsWith('/buscar') || pathname.startsWith('/search')) return 'busca';
  if (pathname.startsWith('/categoria') || pathname.startsWith('/categorias')) return 'categoria';
  if (pathname.startsWith('/cidade') || pathname.startsWith('/cidades')) return 'cidade';
  if (pathname.startsWith('/profissional') || pathname.startsWith('/prestador')) return 'profissional';
  if (pathname.startsWith('/blog')) return 'blog';
  if (pathname.startsWith('/vaga')) return 'vagas';
  if (pathname.startsWith('/curso')) return 'cursos';
  return 'generic';
}

interface CopyContext {
  city: string | null;
  state: string | null;
  pageKind: PageKind;
  isAuthed: boolean;
}

interface ExitCopy {
  title: string;
  body: string;
  primaryCta: string;
  primaryHref: string; // rota interna ou wa.me
  primaryIsWhatsApp: boolean;
  secondaryCta: string;
  secondaryHref: string;
}

function locationPhrase({ city, state }: CopyContext): string {
  if (city && state) return ` em ${city}/${state}`;
  if (city) return ` em ${city}`;
  return ' na sua região';
}

function buildCopy(ctx: CopyContext): ExitCopy {
  const where = locationPhrase(ctx);
  const waMsg = encodeURIComponent(
    `Olá! Estou navegando${where} em precisodeum.com.br e gostaria de me cadastrar. Pode me ajudar?`,
  );
  const waHref = `https://wa.me/${SUPPORT_WHATSAPP}?text=${waMsg}`;

  // Já logado → reduz urgência: sugerimos completar perfil em vez de cadastrar.
  if (ctx.isAuthed) {
    return {
      title: 'Quer aproveitar melhor a plataforma?',
      body: `Vamos finalizar a configuração do seu perfil${where}. Leva menos de 2 minutos e você passa a aparecer pra clientes que estão buscando agora.`,
      primaryCta: 'Completar meu perfil',
      primaryHref: '/dashboard',
      primaryIsWhatsApp: false,
      secondaryCta: 'Falar com o suporte',
      secondaryHref: waHref,
    };
  }

  switch (ctx.pageKind) {
    case 'profissional':
      return {
        title: 'Gostou do que viu?',
        body: `Cadastre-se grátis e receba indicações de profissionais como esse${where} sempre que precisar. Em menos de 1 minuto, sem cartão.`,
        primaryCta: 'Criar conta gratuita',
        primaryHref: '/cadastro',
        primaryIsWhatsApp: false,
        secondaryCta: 'Falar com o suporte',
        secondaryHref: waHref,
      };
    case 'categoria':
      return {
        title: `Ache o profissional ideal${where}`,
        body: `Cadastre-se grátis em 1 minuto para receber indicações personalizadas de profissionais${where}. Você ainda economiza tempo comparando avaliações reais.`,
        primaryCta: 'Quero me cadastrar grátis',
        primaryHref: '/cadastro',
        primaryIsWhatsApp: false,
        secondaryCta: 'Buscar agora',
        secondaryHref: '/buscar',
      };
    case 'cidade':
      return {
        title: `Profissionais verificados${where}`,
        body: `A gente tem dezenas de profissionais ativos${where} prontos pra te atender. Crie sua conta grátis e desbloqueie o contato direto com eles.`,
        primaryCta: 'Cadastro rápido (grátis)',
        primaryHref: '/cadastro',
        primaryIsWhatsApp: false,
        secondaryCta: 'Ver profissionais',
        secondaryHref: '/buscar',
      };
    case 'busca':
      return {
        title: 'Encontre mais rápido com uma conta',
        body: `Cadastre-se grátis para salvar buscas, favoritar profissionais${where} e receber alertas quando alguém novo se cadastrar perto de você.`,
        primaryCta: 'Criar conta agora',
        primaryHref: '/cadastro',
        primaryIsWhatsApp: false,
        secondaryCta: 'Continuar buscando',
        secondaryHref: '#',
      };
    case 'vagas':
      return {
        title: `Quer ser chamado pra trabalhos${where}?`,
        body: 'Profissionais cadastrados aparecem antes nas buscas e recebem leads direto no WhatsApp. Cadastro 100% grátis.',
        primaryCta: 'Cadastrar como profissional',
        primaryHref: '/cadastro?tipo=profissional',
        primaryIsWhatsApp: false,
        secondaryCta: 'Falar com suporte',
        secondaryHref: waHref,
      };
    case 'blog':
    case 'cursos':
      return {
        title: 'Aproveite mais — gratuitamente',
        body: `Cadastre-se grátis para acompanhar conteúdos, salvar artigos e receber recomendações de profissionais${where} sempre que precisar.`,
        primaryCta: 'Quero criar conta',
        primaryHref: '/cadastro',
        primaryIsWhatsApp: false,
        secondaryCta: 'Falar com suporte',
        secondaryHref: waHref,
      };
    case 'home':
    default:
      return {
        title: ctx.city ? `Bem-vindo${where}!` : 'Antes de sair…',
        body: `Cadastre-se grátis em 1 minuto para encontrar profissionais verificados${where} ou aparecer pra clientes que estão buscando agora mesmo. É 100% grátis pra profissionais.`,
        primaryCta: 'Quero me cadastrar grátis',
        primaryHref: '/cadastro',
        primaryIsWhatsApp: false,
        secondaryCta: 'Falar com suporte (WhatsApp)',
        secondaryHref: waHref,
      };
  }
}

function track(event: string, meta: Record<string, unknown>) {
  // Telemetria leve via console + window event (consumido pelos providers globais).
  try {
    window.dispatchEvent(new CustomEvent('precisodeum:telemetry', { detail: { event, meta } }));
    if (typeof console !== 'undefined') {
      console.debug('[exit-intent-global]', event, meta);
    }
  } catch {
    /* noop */
  }
}

export default function GlobalExitIntentDialog() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { city, state } = useGeoCity();
  const [open, setOpen] = useState(false);
  const triggeredRef = useRef(false);
  const inactivityTimer = useRef<number | null>(null);

  const excluded = useMemo(
    () => EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p)),
    [pathname],
  );

  const pageKind = useMemo(() => detectPageKind(pathname), [pathname]);
  const copy = useMemo(
    () => buildCopy({ city, state, pageKind, isAuthed: !!user }),
    [city, state, pageKind, user],
  );

  const baseMeta = useMemo(
    () => ({ pathname, page_kind: pageKind, city, state, authed: !!user }),
    [pathname, pageKind, city, state, user],
  );

  const trigger = useCallback(
    (source: 'mouseleave' | 'inactivity') => {
      if (excluded || triggeredRef.current) return;
      if (shouldSuppressExitIntent()) return;
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') return;
      } catch {
        /* noop */
      }
      triggeredRef.current = true;
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* noop */
      }
      setOpen(true);
      track('global_exit_intent_shown', { ...baseMeta, source });
    },
    [excluded, baseMeta],
  );

  const resetInactivity = useCallback(() => {
    if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
    inactivityTimer.current = window.setTimeout(
      () => trigger('inactivity'),
      INACTIVITY_MS,
    );
  }, [trigger]);

  useEffect(() => {
    if (excluded) return;
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) trigger('mouseleave');
    };
    const onActivity = () => resetInactivity();
    document.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('touchstart', onActivity, { passive: true });
    window.addEventListener('scroll', onActivity, { passive: true });
    resetInactivity();
    return () => {
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('scroll', onActivity);
      if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
    };
  }, [excluded, resetInactivity, trigger]);

  const handlePrimary = useCallback(() => {
    track('global_exit_intent_primary', { ...baseMeta, target: copy.primaryHref });
    if (copy.primaryIsWhatsApp) {
      markSupportContacted({ source: 'other', page_kind: pageKind, origin: 'global_exit_intent' });
      window.open(copy.primaryHref, '_blank', 'noopener,noreferrer');
    }
    setOpen(false);
  }, [baseMeta, copy.primaryHref, copy.primaryIsWhatsApp, pageKind]);

  const handleSecondary = useCallback(() => {
    track('global_exit_intent_secondary', { ...baseMeta, target: copy.secondaryHref });
    if (copy.secondaryHref.startsWith('https://wa.me')) {
      markSupportContacted({ source: 'other', page_kind: pageKind, origin: 'global_exit_intent_secondary' });
      window.open(copy.secondaryHref, '_blank', 'noopener,noreferrer');
    }
    setOpen(false);
  }, [baseMeta, copy.secondaryHref, pageKind]);

  const handleDismiss = useCallback(() => {
    track('global_exit_intent_dismiss', baseMeta);
    setOpen(false);
  }, [baseMeta]);

  if (excluded) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleDismiss())}>
      <DialogContent className="max-w-md" data-testid="global-exit-intent">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-lg">
            <Sparkles className="h-6 w-6" aria-hidden />
          </div>
          <DialogTitle className="text-center text-xl font-extrabold tracking-tight">
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-center text-base leading-relaxed text-muted-foreground">
            {copy.body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {copy.primaryIsWhatsApp ? (
            <Button
              type="button"
              onClick={handlePrimary}
              data-testid="global-exit-intent-primary"
              className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] hover:opacity-95"
            >
              <MessageCircle className="h-4 w-4" />
              {copy.primaryCta}
            </Button>
          ) : (
            <Button
              asChild
              type="button"
              data-testid="global-exit-intent-primary"
              className="w-full gap-2 bg-gradient-to-r from-amber-500 to-rose-500 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(244,114,182,0.6)] hover:opacity-95"
            >
              <Link to={copy.primaryHref} onClick={handlePrimary}>
                <UserPlus className="h-4 w-4" />
                {copy.primaryCta}
              </Link>
            </Button>
          )}

          {copy.secondaryHref.startsWith('http') ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handleSecondary}
              data-testid="global-exit-intent-secondary"
              className="w-full gap-2 font-semibold"
            >
              <MessageCircle className="h-4 w-4" />
              {copy.secondaryCta}
            </Button>
          ) : (
            <Button
              asChild
              type="button"
              variant="secondary"
              data-testid="global-exit-intent-secondary"
              className="w-full gap-2 font-semibold"
            >
              <Link to={copy.secondaryHref} onClick={handleSecondary}>
                <Search className="h-4 w-4" />
                {copy.secondaryCta}
              </Link>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={handleDismiss}
            data-testid="global-exit-intent-dismiss"
            className="w-full gap-2 text-muted-foreground"
          >
            <X className="h-4 w-4" />
            Continuar navegando
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
