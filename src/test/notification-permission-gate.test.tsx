import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import NotificationPermissionGate from '@/components/dashboard/NotificationPermissionGate';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

let hookState: any;
vi.mock('@/hooks/usePwaNotifications', () => ({
  usePwaNotifications: () => hookState,
}));

describe('NotificationPermissionGate', () => {
  beforeEach(() => {
    localStorage.clear();
    hookState = {
      isSupported: true,
      permission: 'default',
      subscribe: vi.fn().mockResolvedValue(true),
      isLoading: false,
    };
  });

  it('NÃO renderiza nada quando navegador não suporta', () => {
    hookState.isSupported = false;
    const { container } = render(<NotificationPermissionGate />);
    expect(container.firstChild).toBeNull();
  });

  it('NÃO renderiza nada quando permission != default', async () => {
    hookState.permission = 'granted';
    const { container } = render(<NotificationPermissionGate />);
    // espera o setTimeout potencial
    await new Promise((r) => setTimeout(r, 1600));
    expect(container.firstChild).toBeNull();
  });

  it('renderiza CTA após delay quando permission=default', async () => {
    render(<NotificationPermissionGate />);
    await waitFor(
      () => expect(screen.getByText(/Receba alertas em tempo real/i)).toBeTruthy(),
      { timeout: 2500 }
    );
  });

  it('persiste dispense em localStorage por 7 dias', async () => {
    render(<NotificationPermissionGate />);
    await waitFor(() => screen.getByText(/Receba alertas/i), { timeout: 2500 });
    fireEvent.click(screen.getByLabelText('Adiar pedido de notificações'));
    expect(localStorage.getItem('notif_perm_gate_dismissed_v1')).toBeTruthy();
  });

  it('chama subscribe ao clicar em "Ativar notificações"', async () => {
    render(<NotificationPermissionGate />);
    await waitFor(() => screen.getByText(/Receba alertas/i), { timeout: 2500 });
    fireEvent.click(screen.getByLabelText('Ativar notificações'));
    await waitFor(() => expect(hookState.subscribe).toHaveBeenCalled());
  });

  it('reage ao evento appinstalled mostrando texto pós-install', async () => {
    render(<NotificationPermissionGate />);
    window.dispatchEvent(new Event('appinstalled'));
    await waitFor(
      () => expect(screen.getByText(/App instalado!/i)).toBeTruthy(),
      { timeout: 2500 }
    );
  });
});
