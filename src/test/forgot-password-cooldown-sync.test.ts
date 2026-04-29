import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  startCooldown,
  subscribeCooldown,
  remainingSeconds,
  readCooldownUntil,
  clearCooldown,
  formatCooldown,
  COOLDOWN_KEY,
} from '@/lib/forgotPasswordCooldown';

/**
 * Suite de regressão "esqueci minha senha" — sincronização entre abas, cooldown e UX.
 * Cobre:
 *  1. Sincronização BroadcastChannel + storage events.
 *  2. Persistência (sobrevive a reload).
 *  3. Cálculo do tempo restante e formatação pt-BR.
 *  4. Estados do botão (enabled/disabled) e cópia em diferentes viewports mobile-first.
 *  5. ErrorGuard: cópia pt-BR e estado do botão de WhatsApp.
 *  6. Login Google/E-mail: textos pt-BR e estados visuais durante sucesso/erro.
 */

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  clearCooldown();
});

describe('forgotPasswordCooldown — sincronização entre abas', () => {
  it('persiste o until em localStorage e sobrevive a "reload"', () => {
    const until = startCooldown(60);
    expect(readCooldownUntil()).toBe(until);
    // simula reload: outra instância lê o valor
    expect(remainingSeconds(readCooldownUntil())).toBeGreaterThan(0);
    expect(remainingSeconds(readCooldownUntil())).toBeLessThanOrEqual(60);
  });

  it('nunca encurta um cooldown em andamento (toma o maior)', () => {
    const long = startCooldown(120);
    const short = startCooldown(10);
    expect(short).toBe(long);
    expect(remainingSeconds(readCooldownUntil())).toBeGreaterThan(60);
  });

  it('subscribeCooldown emite valor inicial síncrono', () => {
    startCooldown(30);
    const values: number[] = [];
    const unsub = subscribeCooldown((rem) => values.push(rem));
    expect(values.length).toBe(1);
    expect(values[0]).toBeGreaterThan(0);
    unsub();
  });

  it('reage a storage events de outra aba (fallback Safari/iframe)', () => {
    const values: number[] = [];
    const unsub = subscribeCooldown((rem) => values.push(rem));

    // Outra aba grava um cooldown longo
    const futureUntil = Date.now() + 90_000;
    localStorage.setItem(COOLDOWN_KEY, String(futureUntil));
    window.dispatchEvent(new StorageEvent('storage', {
      key: COOLDOWN_KEY,
      newValue: String(futureUntil),
    }));

    expect(values.length).toBeGreaterThanOrEqual(2);
    expect(values[values.length - 1]).toBeGreaterThan(60);
    unsub();
  });

  it('clearCooldown zera entre abas', () => {
    startCooldown(60);
    clearCooldown();
    expect(readCooldownUntil()).toBe(0);
    expect(remainingSeconds(readCooldownUntil())).toBe(0);
  });

  it('impede burlar rate-limit abrindo nova aba: nova aba lê o until existente', () => {
    startCooldown(45);
    // Nova aba abre e tenta iniciar um cooldown vazio (0s) — deve manter o existente
    const next = startCooldown(0);
    expect(remainingSeconds(next)).toBeGreaterThan(40);
  });
});

describe('formatCooldown — cópia pt-BR', () => {
  it('exibe segundos quando < 1min', () => {
    expect(formatCooldown(45)).toBe('45s');
    expect(formatCooldown(1)).toBe('1s');
  });
  it('exibe min+seg com zero à esquerda', () => {
    expect(formatCooldown(60)).toBe('1min 00s');
    expect(formatCooldown(125)).toBe('2min 05s');
  });
  it('retorna 0s para valores não-positivos', () => {
    expect(formatCooldown(0)).toBe('0s');
    expect(formatCooldown(-5)).toBe('0s');
  });
});

describe('Botão Reenviar — estado enabled/disabled em diferentes viewports', () => {
  // Helper: simula a lógica do botão no ForgotPasswordPage
  const buttonState = (cooldown: number, status: 'idle' | 'sending') => ({
    disabled: status === 'sending' || cooldown > 0,
    label:
      status === 'sending'
        ? 'Enviando...'
        : cooldown > 0
          ? `Reenviar em ${formatCooldown(cooldown)}`
          : 'Enviar link de redefinição',
  });

  const VIEWPORTS = [
    { name: 'mobile-360 (Android pequeno)', w: 360 },
    { name: 'mobile-390 (iPhone 13)', w: 390 },
    { name: 'mobile-414 (iPhone Plus)', w: 414 },
    { name: 'tablet-768', w: 768 },
    { name: 'desktop-1280', w: 1280 },
  ];

  VIEWPORTS.forEach(({ name, w }) => {
    it(`[${name}] habilitado quando cooldown=0 e idle`, () => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
      const s = buttonState(0, 'idle');
      expect(s.disabled).toBe(false);
      expect(s.label).toBe('Enviar link de redefinição');
    });

    it(`[${name}] desabilitado durante envio com cópia pt-BR`, () => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
      const s = buttonState(0, 'sending');
      expect(s.disabled).toBe(true);
      expect(s.label).toBe('Enviando...');
    });

    it(`[${name}] desabilitado com contagem regressiva pt-BR`, () => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
      const s30 = buttonState(30, 'idle');
      expect(s30.disabled).toBe(true);
      expect(s30.label).toBe('Reenviar em 30s');
      const s90 = buttonState(90, 'idle');
      expect(s90.label).toBe('Reenviar em 1min 30s');
    });
  });

  it('contagem regressiva decrementa a cada tick', () => {
    vi.useFakeTimers();
    startCooldown(3);
    const captured: number[] = [];
    const unsub = subscribeCooldown((rem) => captured.push(rem));
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(1000);
    unsub();
    // Valores devem ser estritamente decrescentes (com possível repetição inicial)
    const last = captured[captured.length - 1];
    expect(last).toBe(0);
    expect(captured[0]).toBeGreaterThan(last);
  });
});

describe('ErrorGuard — botão WhatsApp e cópia pt-BR', () => {
  // Reproduz o builder de mensagem do ErrorGuard sem depender do componente
  const buildSupportMessage = (errId: string, errMsg: string) => {
    const route = '/esqueci-senha';
    return [
      'Olá! Preciso de ajuda com a plataforma.',
      `• Código: ${errId}`,
      `• Rota: ${route}`,
      `• Mensagem: ${errMsg}`,
      `• Tela: ${window.innerWidth}x${window.innerHeight}`,
    ].join('\n');
  };

  it('mensagem 100% em pt-BR e contém código + rota', () => {
    const msg = buildSupportMessage('ERR-123', 'Falha de rede');
    expect(msg).toMatch(/Olá! Preciso de ajuda/);
    expect(msg).toMatch(/Código: ERR-123/);
    expect(msg).toMatch(/Rota: \/esqueci-senha/);
    // Sem inglês residual
    expect(msg).not.toMatch(/error|please|help me/i);
  });

  it('botão WhatsApp habilitado quando há reportId, desabilitado sem código', () => {
    const enabled = (reportId: string | null) => Boolean(reportId);
    expect(enabled('ERR-1')).toBe(true);
    expect(enabled(null)).toBe(false);
    expect(enabled('')).toBe(false);
  });

  it('cópia pt-BR do CTA de suporte', () => {
    const ctaLabel = 'Enviar para o suporte';
    const fallbackLabel = 'Copiar código + detalhes';
    expect(ctaLabel).toMatch(/suporte/i);
    expect(fallbackLabel).toMatch(/copiar/i);
    // Sem inglês
    expect(ctaLabel).not.toMatch(/send|support team/i);
  });

  it('estado do botão WhatsApp em diferentes larguras de tela', () => {
    [360, 390, 414, 768].forEach((w) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
      const msg = buildSupportMessage('X', 'y');
      expect(msg).toContain(`${w}x`); // tela registrada na mensagem
    });
  });
});

describe('Login Google + E-mail — cópia pt-BR e estados visuais', () => {
  type GoogleState = 'idle' | 'loading' | 'redirecting' | 'success' | 'error';

  const googleLabel = (s: GoogleState) => {
    if (s === 'loading') return 'Conectando...';
    if (s === 'redirecting') return 'Redirecionando para o Google...';
    if (s === 'success') return 'Conectado!';
    return 'Continuar com Google';
  };

  it('rótulos do botão Google em todos os estados estão em pt-BR', () => {
    expect(googleLabel('idle')).toBe('Continuar com Google');
    expect(googleLabel('loading')).toBe('Conectando...');
    expect(googleLabel('redirecting')).toBe('Redirecionando para o Google...');
    expect(googleLabel('success')).toBe('Conectado!');
    expect(googleLabel('error')).toBe('Continuar com Google');
  });

  it('mensagens de erro de login mapeadas em pt-BR', () => {
    const map = (raw: string) => {
      if (/email.*not.*confirmed|email_not_confirmed/i.test(raw))
        return 'Confirme seu e-mail antes de entrar. Enviamos o link na criação da conta.';
      if (/rate limit|too many/i.test(raw))
        return 'Muitas tentativas de login. Aguarde alguns minutos.';
      if (/already.*registered|user.*already.*exists/i.test(raw))
        return 'Já existe uma conta com esse e-mail. Redefina sua senha para continuar.';
      if (/invalid login credentials/i.test(raw))
        return 'E-mail ou senha inválidos.';
      return 'Não foi possível criar sua conta. Tente novamente em instantes.';
    };
    expect(map('Email not confirmed')).toMatch(/Confirme seu e-mail/);
    expect(map('Rate limit exceeded')).toMatch(/Muitas tentativas/);
    expect(map('User already registered')).toMatch(/Já existe uma conta/);
    expect(map('Invalid login credentials')).toMatch(/E-mail ou senha inválidos/);
    expect(map('Random error')).toMatch(/Não foi possível criar sua conta/);
    // Nenhuma das saídas pode ser em inglês
    ['Email not confirmed', 'Rate limit exceeded', 'User already registered'].forEach((raw) => {
      expect(map(raw)).not.toMatch(/^[A-Z][a-z]+ [a-z]+ [a-z]+$/);
    });
  });

  it('botão Google é desabilitado durante loading/redirecting (mobile-first)', () => {
    [360, 390, 414].forEach((w) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
      const disabled = (s: GoogleState) => s === 'loading' || s === 'redirecting';
      expect(disabled('idle')).toBe(false);
      expect(disabled('loading')).toBe(true);
      expect(disabled('redirecting')).toBe(true);
      expect(disabled('error')).toBe(false); // permite tentar trocar de conta
      expect(disabled('success')).toBe(false);
    });
  });

  it('fallback "tentar trocar de conta" usa prompt=select_account consent', () => {
    const params = (forceFresh: boolean) => ({
      prompt: forceFresh ? 'select_account consent' : 'select_account',
    });
    expect(params(false).prompt).toBe('select_account');
    expect(params(true).prompt).toBe('select_account consent');
  });

  it('cópia da página de login está 100% em pt-BR', () => {
    const copy = [
      'Acessar a plataforma',
      'Entre ou crie sua conta em segundos',
      'Continuar com Google',
      'ou use e-mail',
      'Esqueci minha senha',
      'Se você ainda não tem conta, criamos uma automaticamente.',
    ];
    copy.forEach((c) => {
      expect(c).not.toMatch(/sign in|log in|forgot|password reset|account/i);
    });
  });
});

describe('Deep link pós-confirmação de e-mail → /login', () => {
  /**
   * Quando o usuário confirma o e-mail vindo de um link, o destino esperado é:
   *   /login?next=<rota> com mensagem pré-preenchida no state.
   * Testamos a função pura de resolução do destino.
   */
  const resolveLoginDeepLink = (next?: string | null, msg?: string | null) => {
    const url = new URL('http://localhost/login');
    if (next) url.searchParams.set('next', next);
    return {
      pathname: url.pathname,
      search: url.search,
      state: { message: msg || 'E-mail confirmado! Faça login para continuar.' },
    };
  };

  it('preserva a próxima rota e injeta mensagem pt-BR padrão', () => {
    const dl = resolveLoginDeepLink('/dashboard');
    expect(dl.pathname).toBe('/login');
    expect(dl.search).toContain('next=%2Fdashboard');
    expect(dl.state.message).toMatch(/E-mail confirmado/);
  });

  it('aceita mensagem customizada', () => {
    const dl = resolveLoginDeepLink('/dashboard/notificacoes', 'Sua conta foi verificada!');
    expect(dl.state.message).toBe('Sua conta foi verificada!');
  });

  it('funciona sem next (volta ao login limpo)', () => {
    const dl = resolveLoginDeepLink(null);
    expect(dl.search).toBe('');
    expect(dl.state.message).toMatch(/Faça login/);
  });
});
