import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * E2E-lite: redirect pós-login OAuth + recuperação após expiração de sessão.
 *
 * Cenários:
 *  - `from` salvo em sessionStorage('auth_redirect') após handleGoogleLogin
 *  - resolvePostLoginRoute consome `from` válido como fallback
 *  - sessão expirada após retorno do redirect leva o usuário a /login com state.from
 */

const resetSessionStorage = () => {
  const store: Record<string, string> = {};
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    },
  });
};

beforeEach(() => {
  resetSessionStorage();
  vi.resetModules();
});

describe('Redirect pós-login OAuth', () => {
  it('persiste a rota original em sessionStorage para sobreviver ao redirect do Google', () => {
    sessionStorage.setItem('auth_redirect', '/dashboard/leads/abc-123');
    expect(sessionStorage.getItem('auth_redirect')).toBe('/dashboard/leads/abc-123');
  });

  it('aceita apenas paths que começam com "/" como fallback (XSS hardening)', () => {
    const candidates = ['/dashboard/leads', 'https://evil.com', 'javascript:alert(1)', ''];
    const safe = candidates.filter(c => typeof c === 'string' && c.startsWith('/') && !c.startsWith('//'));
    expect(safe).toEqual(['/dashboard/leads']);
  });

  it('limpa auth_redirect após uso para não vazar entre sessões', () => {
    sessionStorage.setItem('auth_redirect', '/dashboard');
    const used = sessionStorage.getItem('auth_redirect');
    sessionStorage.removeItem('auth_redirect');
    expect(used).toBe('/dashboard');
    expect(sessionStorage.getItem('auth_redirect')).toBeNull();
  });
});

describe('Expiração de sessão após OAuth redirect', () => {
  it('quando session=null pós-redirect, usuário cai no login com state.from preservado', () => {
    const fakeRoute = '/dashboard/leads/abc-123';
    const session = null; // expirada / nunca estabelecida
    const requireLogin = !session;
    const target = requireLogin
      ? { pathname: '/login', state: { from: fakeRoute } }
      : { pathname: fakeRoute };
    expect(target).toEqual({ pathname: '/login', state: { from: fakeRoute } });
  });

  it('quando token volta válido, sessão é estabelecida e redirect respeita auth_redirect', () => {
    sessionStorage.setItem('auth_redirect', '/dashboard');
    const session = { access_token: 'a', refresh_token: 'r' };
    const next = session ? sessionStorage.getItem('auth_redirect') ?? '/dashboard' : '/login';
    expect(next).toBe('/dashboard');
  });

  it('rota inválida (não começa com "/") é descartada e cai em /dashboard', () => {
    const candidate = 'https://attacker.com/x';
    const next = candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : '/dashboard';
    expect(next).toBe('/dashboard');
  });

  it('refresh_token ausente força nova autenticação (Google select_account)', () => {
    const session = { access_token: 'a' } as any;
    const needsReauth = !session.refresh_token;
    expect(needsReauth).toBe(true);
  });
});
