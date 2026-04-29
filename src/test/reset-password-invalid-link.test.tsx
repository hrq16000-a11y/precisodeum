import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const setHash = (hash: string) => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, origin: 'https://app.test', hash },
  });
};

beforeEach(() => {
  setHash('');
});

afterEach(() => {
  vi.useRealTimers();
});

const renderPage = async () => {
  const { default: ResetPasswordPage } = await import('@/pages/ResetPasswordPage');
  render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
};

describe('ResetPasswordPage — link inválido/expirado em pt-BR', () => {
  it('mostra mensagem pt-BR quando hash contém error_code', async () => {
    setHash('#error=access_denied&error_code=otp_expired');
    await renderPage();
    expect(
      await screen.findByText(/expirou ou não é mais válido/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ir para o login/i)).toBeInTheDocument();
  });

  it('cai em estado inválido após timeout sem evento PASSWORD_RECOVERY', async () => {
    await renderPage();
    // O componente usa setTimeout(1800ms) — esperamos com timeout real
    await waitFor(
      () => expect(screen.getByText(/expirou ou não é mais válido/i)).toBeInTheDocument(),
      { timeout: 4000 },
    );
  });
});
