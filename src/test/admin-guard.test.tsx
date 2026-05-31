/**
 * AdminGuard — cobertura unitária.
 *
 * Inclui:
 *  • cenários de auth/role (login, dashboard, erro, sucesso)
 *  • verificação de contrato da RPC has_role
 *  • cache reuse: navegar entre /admin/* não dispara nova RPC (staleTime 5min)
 *  • telemetria __adminGuardTelemetry registra 1 chamada por usuário
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminGuard, { __adminGuardTelemetry } from '@/components/AdminGuard';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const rpcMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: any[]) => rpcMock(...args) },
}));

let authState: any = { user: null, loading: false };
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
  useAuthIdentity: () => authState,
  useAuthProfile: () => authState,
}));

const Allowed = () => (
  <div>
    <span>conteúdo-admin</span>
    <Link to="/admin/usuarios">ir-usuarios</Link>
    <Link to="/admin/categorias">ir-categorias</Link>
  </div>
);
const AllowedUsers = () => <div>tela-usuarios</div>;
const AllowedCats = () => <div>tela-categorias</div>;
const Dash = () => <div>tela-dashboard</div>;
const LoginPg = () => <div>tela-login</div>;

const makeClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 1000 * 60 * 30, staleTime: 1000 * 60 * 5 },
    },
  });

const renderGuard = (initial = '/admin', client = makeClient()) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/admin" element={<AdminGuard><Allowed /></AdminGuard>} />
          <Route
            path="/admin/usuarios"
            element={<AdminGuard><AllowedUsers /></AdminGuard>}
          />
          <Route
            path="/admin/categorias"
            element={<AdminGuard><AllowedCats /></AdminGuard>}
          />
          <Route path="/dashboard" element={<Dash />} />
          <Route path="/login" element={<LoginPg />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('AdminGuard', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    __adminGuardTelemetry.reset();
    authState = { user: null, loading: false };
  });

  it('redireciona usuário NÃO autenticado para /login', async () => {
    renderGuard();
    await waitFor(() => expect(screen.queryByText('tela-login')).toBeTruthy());
  });

  it('mostra loading enquanto checa role', () => {
    authState = { user: { id: 'u1' }, loading: false };
    rpcMock.mockReturnValue(new Promise(() => {}));
    renderGuard();
    expect(screen.getByText(/Verificando permiss/i)).toBeTruthy();
  });

  it('redireciona usuário comum (has_role=false) para /dashboard', async () => {
    authState = { user: { id: 'u1' }, loading: false };
    rpcMock.mockResolvedValue({ data: false, error: null });
    renderGuard();
    await waitFor(() => expect(screen.queryByText('tela-dashboard')).toBeTruthy());
    expect(screen.queryByText('conteúdo-admin')).toBeNull();
  });

  it('libera acesso quando has_role=true', async () => {
    authState = { user: { id: 'admin-1' }, loading: false };
    rpcMock.mockResolvedValue({ data: true, error: null });
    renderGuard();
    await waitFor(() => expect(screen.queryByText('conteúdo-admin')).toBeTruthy());
  });

  it('nega quando RPC retorna erro (failure-closed)', async () => {
    authState = { user: { id: 'u1' }, loading: false };
    rpcMock.mockResolvedValue({ data: null, error: { message: 'down' } });
    renderGuard();
    await waitFor(() => expect(screen.queryByText('tela-dashboard')).toBeTruthy());
    expect(screen.queryByText('conteúdo-admin')).toBeNull();
  });

  it('chama RPC has_role com user.id e role admin', async () => {
    authState = { user: { id: 'abc' }, loading: false };
    rpcMock.mockResolvedValue({ data: true, error: null });
    renderGuard();
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    expect(rpcMock).toHaveBeenCalledWith('has_role', { _user_id: 'abc', _role: 'admin' });
  });

  it('reaproveita cache: navegar entre /admin/* NÃO dispara nova RPC', async () => {
    authState = { user: { id: 'admin-xyz' }, loading: false };
    rpcMock.mockResolvedValue({ data: true, error: null });
    const client = makeClient();

    // Monta 1ª rota /admin
    const { unmount } = renderGuard('/admin', client);
    await waitFor(() => expect(screen.queryByText('conteúdo-admin')).toBeTruthy());
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(__adminGuardTelemetry.totalRpcCalls).toBe(1);
    expect(__adminGuardTelemetry.rpcCallsByUser.get('admin-xyz')).toBe(1);
    unmount();

    // Monta 2ª rota /admin/usuarios reaproveitando o MESMO QueryClient.
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/admin/usuarios']}>
          <Routes>
            <Route
              path="/admin/usuarios"
              element={<AdminGuard><AllowedUsers /></AdminGuard>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.queryByText('tela-usuarios')).toBeTruthy());

    // Cache deve ter sido reaproveitado — nenhuma RPC nova.
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(__adminGuardTelemetry.totalRpcCalls).toBe(1);
  });

  it('telemetria incrementa por user.id distinto', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });

    authState = { user: { id: 'user-a' }, loading: false };
    const client = makeClient();
    const r1 = renderGuard('/admin', client);
    await waitFor(() => expect(screen.queryByText('conteúdo-admin')).toBeTruthy());
    r1.unmount();

    // Troca de usuário → nova queryKey → nova RPC.
    authState = { user: { id: 'user-b' }, loading: false };
    const client2 = makeClient();
    renderGuard('/admin', client2);
    await waitFor(() => expect(screen.queryByText('conteúdo-admin')).toBeTruthy());

    expect(__adminGuardTelemetry.rpcCallsByUser.get('user-a')).toBe(1);
    expect(__adminGuardTelemetry.rpcCallsByUser.get('user-b')).toBe(1);
    expect(__adminGuardTelemetry.totalRpcCalls).toBe(2);
  });
});
