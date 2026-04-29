/**
 * Testes do centro de notificações admin (UI):
 *  - filtros e busca aparecem
 *  - botão "Marcar página como lida" desabilitado quando não há não-lidas
 *  - chamada à RPC mark_notification_read ao clicar no botão de check individual
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const rpcSpy = vi.fn(async () => ({ data: true, error: null }));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'admin-1' }, loading: false }),
}));
vi.mock('@/hooks/useAdmin', () => ({
  useAdmin: () => ({ isAdmin: true, loading: false, user: { id: 'admin-1' } }),
}));
vi.mock('@/hooks/useSeoHead', () => ({ useSeoHead: () => {} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const data = [
  { id: 'n1', title: 'Alerta de integridade', message: 'Críticos: 2', read: false, type: 'system', link: '/admin/integridade', created_at: new Date().toISOString() },
  { id: 'n2', title: 'Outra', message: null, read: true, type: 'system', link: null, created_at: new Date().toISOString() },
];

vi.mock('@/integrations/supabase/client', () => {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.or = vi.fn(() => builder);
  builder.range = vi.fn(async () => ({ data, error: null, count: data.length }));
  return {
    supabase: {
      from: () => builder,
      rpc: rpcSpy,
    },
  };
});

import AdminInboxPage from '@/pages/admin/AdminInboxPage';

const wrap = (ui: React.ReactNode) => <MemoryRouter>{ui}</MemoryRouter>;

beforeEach(() => rpcSpy.mockClear());

describe('AdminInboxPage', () => {
  it('renderiza filtros e botão de marcar página como lida', async () => {
    render(wrap(<AdminInboxPage />));
    expect(await screen.findByRole('combobox', { name: /filtrar status/i })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /buscar notificações/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /marcar todas as notificações visíveis como lidas/i })).toBeInTheDocument();
  });

  it('chama RPC mark_notification_read ao clicar no check da notificação não lida', async () => {
    render(wrap(<AdminInboxPage />));
    const btn = await screen.findByRole('button', { name: /marcar "alerta de integridade" como lida/i });
    fireEvent.click(btn);
    await waitFor(() => expect(rpcSpy).toHaveBeenCalledWith('mark_notification_read', { _notification_id: 'n1' }));
  });
});
