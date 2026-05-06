/**
 * whatsapp-unlock-dialog.test.tsx
 * Cobre o WhatsAppUnlockDialog: estado de loading, bloqueio sem cota,
 * tratamento do erro P0001 (limite diario) e comportamento de reuso.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WhatsAppUnlockDialog } from '@/components/WhatsAppUnlockDialog';

// ---- Mocks ----
const rpcMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: any[]) => rpcMock(...args) },
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u@test.com' } }),
}));
const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: any[]) => toastMock(...a) }));

const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <WhatsAppUnlockDialog
          open
          onOpenChange={() => {}}
          providerId="prov-1"
          providerName="Joao Encanador"
          whatsappUrl="https://wa.me/5511999999999"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rpcMock.mockReset();
  toastMock.mockReset();
  openSpy.mockClear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('WhatsAppUnlockDialog', () => {
  it('mostra estado de loading enquanto a cota carrega', async () => {
    let resolveQuota: (v: any) => void = () => {};
    rpcMock.mockImplementationOnce(
      () => new Promise((res) => { resolveQuota = res; }),
    );
    renderDialog();
    expect(rpcMock).toHaveBeenCalledWith('get_whatsapp_clicks_today');
    // CTA principal desabilitado durante loading
    const confirm = screen.getByRole('button', { name: /confirmar e ver whatsapp/i });
    expect(confirm).toBeDisabled();
    await act(async () => {
      resolveQuota({ data: { used_today: 0, remaining_today: 3, daily_limit: 3 }, error: null });
    });
  });

  it('bloqueia o CTA e exibe alerta quando a cota acabou', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { used_today: 3, remaining_today: 0, daily_limit: 3 },
      error: null,
    });
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText(/limite diario atingido/i)).toBeInTheDocument();
    });
    const confirm = screen.getByRole('button', { name: /confirmar e ver whatsapp/i });
    expect(confirm).toBeDisabled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('trata o erro P0001 vindo do RPC sem abrir WhatsApp', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: { used_today: 2, remaining_today: 1, daily_limit: 3 }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'P0001', message: 'Limite diario de 3 contatos atingido.' },
      })
      // refetch da cota apos erro
      .mockResolvedValueOnce({ data: { used_today: 3, remaining_today: 0, daily_limit: 3 }, error: null });

    renderDialog();
    const confirm = await screen.findByRole('button', { name: /confirmar e ver whatsapp/i });
    await waitFor(() => expect(confirm).not.toBeDisabled());
    await act(async () => { fireEvent.click(confirm); });
    await waitFor(() => {
      expect(screen.getByText(/limite diario.*atingido/i)).toBeInTheDocument();
    });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('reaproveita a cota quando a RPC retorna reused: true', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: { used_today: 1, remaining_today: 2, daily_limit: 3 }, error: null })
      .mockResolvedValueOnce({
        data: { reused: true, used_today: 1, remaining_today: 2, daily_limit: 3 },
        error: null,
      });

    renderDialog();
    const confirm = await screen.findByRole('button', { name: /confirmar e ver whatsapp/i });
    await waitFor(() => expect(confirm).not.toBeDisabled());
    await act(async () => { fireEvent.click(confirm); });
    // delay interno (setTimeout 80ms) antes do open
    await act(async () => { vi.advanceTimersByTime(120); });

    await waitFor(() => expect(openSpy).toHaveBeenCalledWith(
      'https://wa.me/5511999999999',
      '_blank',
      'noopener,noreferrer',
    ));
    // Toast informa reuso
    const reusedToast = toastMock.mock.calls.find(
      (c) => /ja desbloqueado/i.test(c[0]?.title ?? ''),
    );
    expect(reusedToast).toBeTruthy();
  });
});
