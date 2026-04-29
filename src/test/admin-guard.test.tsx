import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminGuard from '@/components/AdminGuard';

// Mock toast
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Mock supabase
const rpcMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: any[]) => rpcMock(...args) },
}));

// Mock useAuth — controlado por test
let authState: any = { user: null, loading: false };
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

const Allowed = () => <div>conteúdo-admin</div>;
const Dash = () => <div>tela-dashboard</div>;
const LoginPg = () => <div>tela-login</div>;

const renderGuard = (initial = '/admin') => render(
  <MemoryRouter initialEntries={[initial]}>
    <Routes>
      <Route path="/admin" element={<AdminGuard><Allowed /></AdminGuard>} />
      <Route path="/dashboard" element={<Dash />} />
      <Route path="/login" element={<LoginPg />} />
    </Routes>
  </MemoryRouter>
);

describe('AdminGuard', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    authState = { user: null, loading: false };
  });

  it('redireciona usuário NÃO autenticado para /login', async () => {
    authState = { user: null, loading: false };
    renderGuard();
    await waitFor(() => {
      expect(screen.queryByText('tela-login')).toBeTruthy();
    });
  });

  it('mostra loading enquanto checa role', async () => {
    authState = { user: { id: 'u1' }, loading: false };
    rpcMock.mockReturnValue(new Promise(() => {})); // pendente para sempre
    renderGuard();
    expect(screen.getByText(/Verificando permiss/i)).toBeTruthy();
  });

  it('redireciona usuário comum (has_role=false) para /dashboard', async () => {
    authState = { user: { id: 'u1' }, loading: false };
    rpcMock.mockResolvedValue({ data: false, error: null });
    renderGuard();
    await waitFor(() => {
      expect(screen.queryByText('tela-dashboard')).toBeTruthy();
    });
    expect(screen.queryByText('conteúdo-admin')).toBeNull();
  });

  it('libera acesso quando has_role=true', async () => {
    authState = { user: { id: 'admin-1' }, loading: false };
    rpcMock.mockResolvedValue({ data: true, error: null });
    renderGuard();
    await waitFor(() => {
      expect(screen.queryByText('conteúdo-admin')).toBeTruthy();
    });
  });

  it('nega quando RPC retorna erro (failure-closed)', async () => {
    authState = { user: { id: 'u1' }, loading: false };
    rpcMock.mockResolvedValue({ data: null, error: { message: 'down' } });
    renderGuard();
    await waitFor(() => {
      expect(screen.queryByText('tela-dashboard')).toBeTruthy();
    });
    expect(screen.queryByText('conteúdo-admin')).toBeNull();
  });

  it('chama RPC has_role com user.id e role admin', async () => {
    authState = { user: { id: 'abc' }, loading: false };
    rpcMock.mockResolvedValue({ data: true, error: null });
    renderGuard();
    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    expect(rpcMock).toHaveBeenCalledWith('has_role', { _user_id: 'abc', _role: 'admin' });
  });
});
