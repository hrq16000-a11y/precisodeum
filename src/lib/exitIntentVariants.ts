/**
 * exitIntentVariants — copy do exit-intent do wizard com:
 *  - 2 variações A/B (sticky por sessão via sessionStorage)
 *  - Ajuste por etapa do cadastro (triage/main/extras)
 *  - Ajuste por intent (client / professional)
 *
 * A telemetria registra `variant` + `phase_group` + `intent` em onboarding_events,
 * permitindo analisar qual criativo reduz mais abandono por fase.
 */

const VARIANT_KEY = 'wizard:exit-intent-variant';
const SUPPORT_WHATSAPP = '5541997452053';

export type ExitIntentVariant = 'A' | 'B';
export type ExitIntentIntent = 'client' | 'professional' | 'unknown';
export type ExitIntentPhaseGroup = 'triage' | 'main' | 'extras' | 'other';

export interface ExitIntentCopy {
  title: string;
  body: string;
  ctaPrimary: string;
  ctaDismiss: string;
  whatsappMessage: string;
  whatsappUrl: string;
}

export interface ExitIntentContext {
  phase: string;
  intent: ExitIntentIntent;
}

/** Resolve fase string → grupo macro para roteamento de copy. */
export function phaseGroup(phase: string): ExitIntentPhaseGroup {
  if (phase.startsWith('triage_')) return 'triage';
  if (phase === 'main_more_services' || phase === 'main_portfolio_albums') return 'extras';
  if (phase.startsWith('main_') || phase.startsWith('phase')) return 'main';
  return 'other';
}

/** Variante sticky por sessão (50/50 determinístico após 1ª escolha). */
export function getSessionVariant(): ExitIntentVariant {
  if (typeof window === 'undefined') return 'A';
  try {
    const cached = sessionStorage.getItem(VARIANT_KEY);
    if (cached === 'A' || cached === 'B') return cached;
    const v: ExitIntentVariant = Math.random() < 0.5 ? 'A' : 'B';
    sessionStorage.setItem(VARIANT_KEY, v);
    return v;
  } catch {
    return 'A';
  }
}

/** Helper para forçar variante em testes. */
export function setSessionVariantForTest(v: ExitIntentVariant | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (v === null) sessionStorage.removeItem(VARIANT_KEY);
    else sessionStorage.setItem(VARIANT_KEY, v);
  } catch {
    /* noop */
  }
}

function buildWhatsappUrl(message: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

/**
 * Resolve copy final combinando variant + phase group + intent.
 *
 * Eixos:
 *  - Profissional na triagem: foco em "aparecer no site" e "finalizar cadastro".
 *  - Profissional na main/extras: foco em "publicar serviço" e "começar a receber clientes".
 *  - Cliente: foco em "encontrar profissional certo" e "tirar dúvida".
 */
export function resolveExitIntentCopy(
  variant: ExitIntentVariant,
  ctx: ExitIntentContext,
): ExitIntentCopy {
  const group = phaseGroup(ctx.phase);
  const isClient = ctx.intent === 'client';

  // ---------- CLIENTE ----------
  if (isClient) {
    if (variant === 'A') {
      const msg =
        'Olá! Estou tentando encontrar um profissional em www.precisodeumprofissional.com.br e gostaria de ajuda para finalizar minha busca.';
      return {
        title: 'Precisa de ajuda para encontrar o profissional certo?',
        body:
          'Nosso time pode te indicar agora mesmo um profissional verificado na sua cidade. Fale com a gente pelo WhatsApp e resolvemos juntos em poucos minutos.',
        ctaPrimary: 'Falar com o suporte agora',
        ctaDismiss: 'Continuar buscando sozinho',
        whatsappMessage: msg,
        whatsappUrl: buildWhatsappUrl(msg),
      };
    }
    const msg =
      'Olá! Vim de www.precisodeumprofissional.com.br e quero uma indicação rápida de profissional na minha região.';
    return {
      title: 'Quer uma indicação personalizada?',
      body:
        'Conta pra gente o que você precisa e indicamos um profissional ideal pra você no WhatsApp, sem custo.',
      ctaPrimary: 'Quero uma indicação no WhatsApp',
      ctaDismiss: 'Continuar navegando',
      whatsappMessage: msg,
      whatsappUrl: buildWhatsappUrl(msg),
    };
  }

  // ---------- PROFISSIONAL — TRIAGEM ----------
  if (group === 'triage') {
    if (variant === 'A') {
      const msg =
        'Olá! Estou começando meu cadastro em www.precisodeumprofissional.com.br e gostaria de ajuda para finalizar meu perfil.';
      return {
        title: 'Está com alguma dificuldade no cadastro?',
        body:
          'Não queremos que você perca a chance de aparecer em www.precisodeumprofissional.com.br. Fale com nosso suporte agora pelo WhatsApp e finalizamos o cadastro juntos com você.',
        ctaPrimary: 'Falar com o suporte no WhatsApp',
        ctaDismiss: 'Continuar sozinho',
        whatsappMessage: msg,
        whatsappUrl: buildWhatsappUrl(msg),
      };
    }
    const msg =
      'Oi! Estou tentando me cadastrar como profissional em precisodeumprofissional.com.br. Pode me ajudar a terminar?';
    return {
      title: 'Faltam só alguns passos para você aparecer pra clientes',
      body:
        'A maioria dos profissionais leva menos de 3 minutos para concluir. Se preferir, fazemos o cadastro com você por WhatsApp agora mesmo.',
      ctaPrimary: 'Concluir com ajuda do suporte',
      ctaDismiss: 'Vou tentar mais um pouco',
      whatsappMessage: msg,
      whatsappUrl: buildWhatsappUrl(msg),
    };
  }

  // ---------- PROFISSIONAL — MAIN (serviço/perfil) ----------
  if (group === 'main') {
    if (variant === 'A') {
      const msg =
        'Olá! Estou cadastrando meu primeiro serviço em precisodeumprofissional.com.br e travei. Pode me ajudar?';
      return {
        title: 'Falta pouco para seu serviço ficar no ar',
        body:
          'Cadastrar o primeiro serviço é o passo que libera contatos de clientes pra você. Se travou em algo, nosso suporte conclui com você no WhatsApp.',
        ctaPrimary: 'Concluir meu serviço com o suporte',
        ctaDismiss: 'Vou continuar agora',
        whatsappMessage: msg,
        whatsappUrl: buildWhatsappUrl(msg),
      };
    }
    const msg =
      'Oi! Tô finalizando o cadastro do meu serviço em precisodeumprofissional.com.br e queria uma ajuda rápida.';
    return {
      title: 'Não saia sem publicar seu serviço',
      body:
        'Profissionais que publicam o primeiro serviço recebem em média mais contatos já na primeira semana. Quer ajuda do suporte para terminar agora?',
      ctaPrimary: 'Quero ajuda para publicar',
      ctaDismiss: 'Continuar sozinho',
      whatsappMessage: msg,
      whatsappUrl: buildWhatsappUrl(msg),
    };
  }

  // ---------- PROFISSIONAL — EXTRAS (mais serviços / portfólio) ----------
  if (group === 'extras') {
    if (variant === 'A') {
      const msg =
        'Olá! Estou na etapa final do cadastro em precisodeumprofissional.com.br (mais serviços / portfólio). Pode me ajudar?';
      return {
        title: 'Quer turbinar seu perfil antes de sair?',
        body:
          'Adicionar mais serviços e fotos no portfólio aumenta muito sua visibilidade na busca. Se preferir, nosso suporte ajuda a configurar agora.',
        ctaPrimary: 'Configurar com o suporte',
        ctaDismiss: 'Faço isso depois',
        whatsappMessage: msg,
        whatsappUrl: buildWhatsappUrl(msg),
      };
    }
    const msg =
      'Oi! Já cadastrei meu primeiro serviço, mas quero ajuda para deixar meu perfil mais completo.';
    return {
      title: 'Seu perfil está quase pronto',
      body:
        'Mais serviços e portfólio = mais clientes. Se quiser, o suporte te orienta no WhatsApp pra finalizar do jeito certo.',
      ctaPrimary: 'Quero finalizar com o suporte',
      ctaDismiss: 'Faço isso depois',
      whatsappMessage: msg,
      whatsappUrl: buildWhatsappUrl(msg),
    };
  }

  // ---------- FALLBACK genérico ----------
  const msg =
    'Olá! Estou navegando em precisodeumprofissional.com.br e gostaria de ajuda do suporte.';
  return {
    title: 'Podemos te ajudar agora?',
    body:
      'Nosso suporte responde rapidamente no WhatsApp e pode te ajudar a concluir o que precisar.',
    ctaPrimary: 'Falar com o suporte',
    ctaDismiss: 'Continuar sozinho',
    whatsappMessage: msg,
    whatsappUrl: buildWhatsappUrl(msg),
  };
}
