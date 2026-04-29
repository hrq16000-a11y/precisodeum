import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * E2E mobile-first (jsdom) — LoginPage:
 * - Cópia pt-BR
 * - Erro de senha fraca → toast pt-BR
 * - Conta já existente → toast pt-BR
 */

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const signInWithOAuth = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signUp: (...a: unknown[]) => signUp(...a),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
  },
}));
vi.mock('@/integrations/lovable/index', () => ({
  lovable: { auth: { signInWithOAuth: (...a: unknown[]) => signInWithOAuth(...a) } },
}));
vi.mock('sonner', () => ({
  toast: { error: (m: string, o?: unknown) => toastError(m, o), success: (m: string) => toastSuccess(m) },
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, profile: null, loading: false }),
}));
vi.mock('@/hooks/useSeoHead', () => ({ useSeoHead: () => {} }));
vi.mock('@/lib/onboardingAccess', () => ({
  resolvePostLoginRoute: async () => '/dashboard',
}));

beforeEach(() => {
  signInWithPassword.mockReset();
  signUp.mockReset();
  signInWithOAuth.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 812 });
});

const renderPage = async () => {
  const { default: LoginPage } = await import('@/pages/LoginPage');
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <LoginPage />
    </MemoryRouter>,
  );
};

const getEmailInput = (): HTMLInputElement =>
  document.querySelector<HTMLInputElement>('input[type="email"]')!;
const getPasswordInput = (): HTMLInputElement =>
  document.querySelector<HTMLInputElement>('input[type="password"]')!;
const getSubmitBtn = (): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>('button[type="submit"]')!;

describe('LoginPage — cópia pt-BR mobile-first', () => {
  it('exibe CTAs e textos em português', async () => {
    await renderPage();
    expect(await screen.findByText(/Acessar a plataforma/i)).toBeInTheDocument();
    expect(screen.getByText(/Continuar com Google/i)).toBeInTheDocument();
    expect(screen.getByText(/ou use e-mail/i)).toBeInTheDocument();
    expect(screen.getByText(/Esqueci minha senha/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Se você ainda não tem conta, criamos uma automaticamente/i),
    ).toBeInTheDocument();
  });

  it('valida e-mail/senha vazios com toast em pt-BR', async () => {
    await renderPage();
    // Bypassa required do HTML disparando submit via API do form
    const form = document.querySelector('form')!;
    // Remove required temporariamente para garantir que o handler rode
    form.querySelectorAll('input').forEach((i) => i.removeAttribute('required'));
    fireEvent.submit(form);
    await waitFor(() => {
      const calls = toastError.mock.calls.map((c) => String(c[0] || ''));
      expect(calls.some((m) => /Preencha e-mail e senha/i.test(m))).toBe(true);
    });
  });
});

describe('LoginPage — cadastro silencioso e senha fraca', () => {
  it('mostra mensagem pt-BR de senha fraca quando o signup falha', async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    signUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Password is too weak / pwned' },
    });

    await renderPage();
    fireEvent.change(getEmailInput(), { target: { value: 'novo@example.com' } });
    fireEvent.change(getPasswordInput(), { target: { value: '123456' } });
    fireEvent.click(getSubmitBtn());

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/Escolha uma senha mais forte/i),
        expect.anything(),
      ),
    );
  });

  it('detecta conta já existente (identities=[]) e mostra toast pt-BR', async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    signUp.mockResolvedValueOnce({
      data: { user: { identities: [] } },
      error: null,
    });
    await renderPage();
    fireEvent.change(getEmailInput(), { target: { value: 'existe@example.com' } });
    fireEvent.change(getPasswordInput(), { target: { value: 'qualquer' } });
    fireEvent.click(getSubmitBtn());
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/Já existe uma conta com esse e-mail/i),
        expect.anything(),
      ),
    );
  });
});
