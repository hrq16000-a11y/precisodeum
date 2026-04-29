/**
 * Testes do centro de notificações admin (UI):
 *  - filtros e busca aparecem
 *  - chamada à RPC mark_notification_read ao clicar no botão de check individual
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => {
  const rpcSpy = (() => {
    const fn: any = (...args: any[]) => { fn.mock.calls.push(args); return Promise.resolve({ data: true, error: null }); };
    fn.mock = { calls: [] as any[] };
    fn.mockClear = () => { fn.mock.calls = []; };
    return fn;
  })();
  return { rpcSpy };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'admin-1' }, loading: false }),
}));
vi.mock('@/hooks/useAdmin', () => ({
  useAdmin: () => ({ isAdmin: true, loading: false, user: { id: 'admin-1' } }),
}));
vi.mock('@/hooks/useSeoHead', () => ({ useSeoHead: () => {} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/integrations/supabase/client', () => {
  const data = [
    { id: 'n1', title: 'Alerta de integridade', message: 'Críticos: 2', read: false, type: 'system', link: '/admin/integridade', created_at: new Date().toISOString() },
    { id: 'n2', title: 'Outra', message: null, read: true, type: 'system', link: null, created_at: new Date().toISOString() },
  ];
  const builder: any = {};
  builder.select = (...a: any[]) => builder;
  builder.eq = (...a: any[]) => builder;
  builder.order = (...a: any[]) => builder;
  builder.or = (...a: any[]) => builder;
  builder.range = async () => ({ data, error: null, count: data.length });
  return {
    supabase: {
      from: () => builder,
      rpc: mocks.rpcSpy,
    },
  };
});

import AdminInboxPage from '@/pages/admin/AdminInboxPage';

const wrap = (ui: React.ReactNode) => <MemoryRouter>{ui}</MemoryRouter>;

beforeEach(() => mocks.rpcSpy.mockClear());

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
    await waitFor(() =>
      expect(mocks.rpcSpy.mock.calls.some(
        (c: any[]) => c[0] === 'mark_notification_read' && c[1]?._notification_id === 'n1',
      )).toBe(true),
    );
  });
});
