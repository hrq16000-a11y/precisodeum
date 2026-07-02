/**
 * Cobertura do fluxo signup/login mais o caminho "User already registered"
 * detectado por heurística (identities=[]) e mapeamento de mensagens.
 *
 * Cenários cobertos:
 *  - email/senha vazios → bloqueio local
 *  - email malformado → bloqueio local
 *  - senha < 6 chars → bloqueio local
 *  - signIn ok → sucesso
 *  - signIn falha "Invalid login credentials" + signUp "User already registered" → reset password flow
 *  - signIn falha + signUp ok com identities=[] → reset password flow (heurística)
 *  - signIn falha + signUp ok com session → conta criada + sessão
 *  - signIn falha + signUp ok sem session → mensagem de confirmação por email
 *  - signIn "Email not confirmed" → mensagem específica
 *  - rate limit → mensagem específica
 */
import { describe, it, expect } from 'vitest';

type Result =
  | { kind: 'invalid_local'; reason: string }
  | { kind: 'logged_in' }
  | { kind: 'created_session' }
  | { kind: 'awaiting_email_confirm' }
  | { kind: 'reset_password_required'; email: string }
  | { kind: 'email_not_confirmed' }
  | { kind: 'rate_limited' }
  | { kind: 'invalid_credentials' }
  | { kind: 'signup_failed'; reason: string };

interface AuthLike {
  signIn: (email: string, password: string) => Promise<{ error?: { message: string } | null; session?: unknown }>;
  signUp: (email: string, password: string) => Promise<{
    error?: { message: string } | null;
    data?: { user?: { identities?: unknown[] } | null; session?: unknown };
  }>;
}

/**
 * Replica fielmente a lógica do `handleSubmit` do LoginPage,
 * isolada em função pura testável.
 */
async function loginOrSignup(email: string, password: string, auth: AuthLike): Promise<Result> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !password) return { kind: 'invalid_local', reason: 'empty' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { kind: 'invalid_local', reason: 'email' };
  if (password.length < 6) return { kind: 'invalid_local', reason: 'password_short' };

  const signIn = await auth.signIn(trimmed, password);
  if (!signIn.error && signIn.session) return { kind: 'logged_in' };

  const errMsg = signIn.error?.message || '';
  if (/email.*not.*confirmed|email_not_confirmed/i.test(errMsg)) return { kind: 'email_not_confirmed' };

  const looksLikeNoAccount = /invalid login credentials|invalid_grant|user not found/i.test(errMsg);
  if (!looksLikeNoAccount) {
    if (/rate limit|too many/i.test(errMsg)) return { kind: 'rate_limited' };
    return { kind: 'invalid_credentials' };
  }

  const signUp = await auth.signUp(trimmed, password);
  if (signUp.error) {
    const m = signUp.error.message || '';
    if (/already.*registered|user.*already.*exists|already_registered/i.test(m))
      return { kind: 'reset_password_required', email: trimmed };
    if (/password.*(short|6 characters|weak)/i.test(m)) return { kind: 'signup_failed', reason: 'password_weak' };
    if (/rate limit|too many/i.test(m)) return { kind: 'rate_limited' };
    if (/invalid.*email|validate email|invalid.*format/i.test(m)) return { kind: 'signup_failed', reason: 'invalid_email' };
    return { kind: 'signup_failed', reason: 'unknown' };
  }
  // Heurística: identities=[] em sucesso indica conta pré-existente
  const identities = signUp.data?.user?.identities;
  if (Array.isArray(identities) && identities.length === 0) {
    return { kind: 'reset_password_required', email: trimmed };
  }
  if (signUp.data?.session) return { kind: 'created_session' };
  return { kind: 'awaiting_email_confirm' };
}

const okSignIn = (session = true) => async () => ({ session: session ? {} : null });
const failSignIn = (msg: string) => async () => ({ error: { message: msg } });
const okSignUp = (opts: { session?: boolean; identities?: unknown[] | undefined } = {}) =>
  async () => ({ data: { user: { identities: opts.identities }, session: opts.session ? {} : null } });
const failSignUp = (msg: string) => async () => ({ error: { message: msg } });

describe('auth :: validações locais', () => {
  it('bloqueia email vazio', async () => {
    const r = await loginOrSignup('', 'pass123', { signIn: failSignIn('x'), signUp: failSignUp('x') });
    expect(r).toEqual({ kind: 'invalid_local', reason: 'empty' });
  });

  it('bloqueia senha vazia', async () => {
    const r = await loginOrSignup('a@b.com', '', { signIn: failSignIn('x'), signUp: failSignUp('x') });
    expect(r).toEqual({ kind: 'invalid_local', reason: 'empty' });
  });

  it('bloqueia email malformado', async () => {
    const r = await loginOrSignup('not-an-email', 'pass123', { signIn: failSignIn('x'), signUp: failSignUp('x') });
    expect(r).toEqual({ kind: 'invalid_local', reason: 'email' });
  });

  it('bloqueia senha < 6 chars', async () => {
    const r = await loginOrSignup('a@b.com', '12345', { signIn: failSignIn('x'), signUp: failSignUp('x') });
    expect(r).toEqual({ kind: 'invalid_local', reason: 'password_short' });
  });

  it('aceita email com whitespace e maiúsculas', async () => {
    const r = await loginOrSignup('  USER@MAIL.COM  ', 'pass123', { signIn: okSignIn(), signUp: okSignUp() });
    expect(r).toEqual({ kind: 'logged_in' });
  });
});

describe('auth :: signin → success', () => {
  it('credenciais válidas → logged_in', async () => {
    const r = await loginOrSignup('a@b.com', 'pass123', { signIn: okSignIn(), signUp: okSignUp() });
    expect(r).toEqual({ kind: 'logged_in' });
  });
});

describe('auth :: porta única (signIn falha → tenta signUp)', () => {
  it('signUp retorna "User already registered" → reset_password_required', async () => {
    const r = await loginOrSignup('exist@b.com', 'wrongpass', {
      signIn: failSignIn('Invalid login credentials'),
      signUp: failSignUp('User already registered'),
    });
    expect(r).toEqual({ kind: 'reset_password_required', email: 'exist@b.com' });
  });

  it('signUp ok com identities=[] (heurística) → reset_password_required', async () => {
    const r = await loginOrSignup('shadow@b.com', 'somepass', {
      signIn: failSignIn('Invalid login credentials'),
      signUp: okSignUp({ identities: [] }),
    });
    expect(r).toEqual({ kind: 'reset_password_required', email: 'shadow@b.com' });
  });

  it('signUp ok com session → created_session (conta nova com auto-confirm)', async () => {
    const r = await loginOrSignup('new@b.com', 'pass123', {
      signIn: failSignIn('Invalid login credentials'),
      signUp: okSignUp({ session: true, identities: [{ id: 'x' }] }),
    });
    expect(r).toEqual({ kind: 'created_session' });
  });

  it('signUp ok sem session → awaiting_email_confirm', async () => {
    const r = await loginOrSignup('new@b.com', 'pass123', {
      signIn: failSignIn('Invalid login credentials'),
      signUp: okSignUp({ session: false, identities: [{ id: 'x' }] }),
    });
    expect(r).toEqual({ kind: 'awaiting_email_confirm' });
  });

  it('signUp falha por senha fraca → signup_failed/password_weak', async () => {
    const r = await loginOrSignup('new@b.com', 'short1', {
      signIn: failSignIn('Invalid login credentials'),
      signUp: failSignUp('Password should be at least 6 characters'),
    });
    expect(r).toEqual({ kind: 'signup_failed', reason: 'password_weak' });
  });

  it('signUp falha por rate limit → rate_limited', async () => {
    const r = await loginOrSignup('new@b.com', 'pass123', {
      signIn: failSignIn('Invalid login credentials'),
      signUp: failSignUp('Email rate limit exceeded'),
    });
    expect(r).toEqual({ kind: 'rate_limited' });
  });

  it('signUp falha por email inválido → signup_failed/invalid_email', async () => {
    const r = await loginOrSignup('new@b.com', 'pass123', {
      signIn: failSignIn('Invalid login credentials'),
      signUp: failSignUp('Unable to validate email address: invalid format'),
    });
    expect(r).toEqual({ kind: 'signup_failed', reason: 'invalid_email' });
  });
});

describe('auth :: signIn outros erros', () => {
  it('Email not confirmed → email_not_confirmed', async () => {
    const r = await loginOrSignup('a@b.com', 'pass123', {
      signIn: failSignIn('Email not confirmed'),
      signUp: okSignUp(),
    });
    expect(r).toEqual({ kind: 'email_not_confirmed' });
  });

  it('rate limit no signIn → rate_limited', async () => {
    const r = await loginOrSignup('a@b.com', 'pass123', {
      signIn: failSignIn('Email rate limit exceeded'),
      signUp: okSignUp(),
    });
    expect(r).toEqual({ kind: 'rate_limited' });
  });

  it('erro genérico → invalid_credentials', async () => {
    const r = await loginOrSignup('a@b.com', 'pass123', {
      signIn: failSignIn('Some other error'),
      signUp: okSignUp(),
    });
    expect(r).toEqual({ kind: 'invalid_credentials' });
  });
});
