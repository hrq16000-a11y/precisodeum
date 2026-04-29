import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Valida pt-BR para link inválido/expirado na página de redefinição.
 * Cobre dois caminhos: (a) hash com error_code; (b) timeout sem PASSWORD_RECOVERY.
 */

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

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, origin: 'https://app.test', hash: '' },
  });
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
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, origin: 'https://app.test', hash: '#error=access_denied&error_code=otp_expired' },
    });
    await renderPage();
    expect(
      await screen.findByText(/expirou ou não é mais válido/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ir para o login/i)).toBeInTheDocument();
  });

  it('cai em estado inválido após timeout sem evento PASSWORD_RECOVERY', async () => {
    await renderPage();
    // Adianta o timer de verificação (1.8s)
    vi.advanceTimersByTime(2000);
    await waitFor(() =>
      expect(screen.getByText(/expirou ou não é mais válido/i)).toBeInTheDocument(),
    );
  });
});
