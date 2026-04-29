import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * E2E mobile-first (jsdom) — LoginPage:
 * - Cópia 100% pt-BR (Google, divisor, CTA, dica de senha fraca)
 * - Cadastro silencioso (porta única) com erro de senha fraca → mensagem pt-BR
 * - Submit valida e-mail vazio com toast pt-BR
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
  toast: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m) },
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
  // viewport mobile-first 375x812
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 812 });
});

const renderPage = async () => {
  const { default: LoginPage } = await import('@/pages/LoginPage');
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <LoginPage />
    </MemoryRouter>,
  );
};

describe('LoginPage — cópia pt-BR mobile-first', () => {
  it('exibe CTAs e textos em português', async () => {
    await renderPage();
    expect(await screen.findByText(/Acessar a plataforma/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar com Google/i })).toBeInTheDocument();
    expect(screen.getByText(/ou use e-mail/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar/i })).toBeInTheDocument();
    expect(screen.getByText(/Esqueci minha senha/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Se você ainda não tem conta, criamos uma automaticamente/i),
    ).toBeInTheDocument();
  });

  it('valida e-mail/senha vazios com toast em pt-BR', async () => {
    await renderPage();
    const form = document.querySelector('form')!;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Preencha e-mail e senha/i)),
    );
  });
});

describe('LoginPage — cadastro silencioso e senha fraca', () => {
  it('exibe mensagem pt-BR de senha fraca quando o signup falha por weak_password', async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    signUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Password is too weak / pwned' },
    });

    await renderPage();
    fireEvent.change(screen.getByLabelText(/^E-mail$/i), { target: { value: 'novo@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Senha$/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/Escolha uma senha mais forte/i),
      ),
    );
  });

  it('detecta conta já existente e abre o fluxo de redefinição em pt-BR', async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    // Heurística do Supabase: sucesso + identities=[]
    signUp.mockResolvedValueOnce({
      data: { user: { identities: [] } },
      error: null,
    });
    await renderPage();
    fireEvent.change(screen.getByLabelText(/^E-mail$/i), { target: { value: 'existe@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Senha$/i), { target: { value: 'qualquer' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/Já existe uma conta com esse e-mail/i),
        expect.any(Object),
      ),
    );
  });
});
