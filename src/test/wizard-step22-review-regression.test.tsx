/**
 * Regressão Step22_Review — etapa de resumo antes de finalizar.
 *
 * Trava o contrato (onBack/onFinalize/onEdit) + os 3 estados visuais:
 *  1. Loading inicial
 *  2. Render bem-sucedido com 5 linhas (identity/service/photos/extras/portfolio)
 *  3. Erro de rede com botão "Tentar de novo"
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

const { supabaseMock } = vi.hoisted(() => ({
  // Step22_Review usa supabase.rpc('get_my_provider_details') para ler
  // providers (necessário para acessar CPF/CNPJ — column-level REVOKE +
  // SECURITY DEFINER). Mantemos `from` para services e portfolio_albums.
  supabaseMock: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

import Step22_Review from '@/components/onboarding/wizard/phases/Step22_Review';

/**
 * Step22_Review lê providers via RPC SECURITY DEFINER
 * `get_my_provider_details` (necessário para CPF/CNPJ — column-level
 * REVOKE). Setamos `supabase.rpc` para esse caso e mantemos `from` para
 * services / portfolio_albums.
 */
function setProviderRpcOk(payload: any) {
  supabaseMock.rpc.mockImplementation((name: string) => {
    if (name === 'get_my_provider_details') {
      return Promise.resolve({ data: payload ? [payload] : [], error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

function setProviderRpcError(message = 'boom') {
  supabaseMock.rpc.mockImplementation((name: string) => {
    if (name === 'get_my_provider_details') {
      return Promise.resolve({ data: null, error: { message } });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

function setProviderRpcReject(message = 'Failed to fetch') {
  supabaseMock.rpc.mockImplementation((name: string) => {
    if (name === 'get_my_provider_details') {
      return Promise.reject(new Error(message));
    }
    return Promise.resolve({ data: null, error: null });
  });
}

function makeServicesCount(c: number) {
  return {
    select: vi.fn().mockImplementation((_cols: string, opts?: any) => {
      if (opts?.head) {
        return { eq: vi.fn().mockResolvedValue({ count: c, data: null, error: null }) };
      }
      return {
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: c > 0 ? [{ id: 's1', gallery_urls: ['x.jpg'] }] : [],
            error: null,
          }),
        }),
      };
    }),
  };
}

function makeAlbumsCount(c: number) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ count: c, data: null, error: null }),
    }),
  };
}

describe('Step22_Review', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') localStorage.clear();
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  function setFromTablesOnly(servicesCount: number, albumsCount: number) {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'services') return makeServicesCount(servicesCount);
      if (table === 'portfolio_albums') return makeAlbumsCount(albumsCount);
      throw new Error(`unexpected ${table}`);
    });
  }

  it('mostra resumo com 5 linhas após carregar', async () => {
    setProviderRpcOk({
      id: 'p1',
      city: 'Curitiba',
      cpf: '12345678901',
      working_hours_struct: { mon: { start: '09:00' } },
    });
    setFromTablesOnly(2, 1);

    render(<Step22_Review onBack={vi.fn()} onFinalize={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('review-row-identity')).toBeInTheDocument();
      expect(screen.getByTestId('review-row-service')).toBeInTheDocument();
      expect(screen.getByTestId('review-row-photos')).toBeInTheDocument();
      expect(screen.getByTestId('review-row-extras')).toBeInTheDocument();
      expect(screen.getByTestId('review-row-portfolio')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Finalizar cadastro/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Voltar$/i })).toBeInTheDocument();
  });

  it('dispara onEdit ao clicar em "Editar Serviços"', async () => {
    setProviderRpcOk({ id: 'p1', city: 'SP', working_hours_struct: {} });
    setFromTablesOnly(1, 0);

    const onEdit = vi.fn();
    render(<Step22_Review onBack={vi.fn()} onFinalize={vi.fn()} onEdit={onEdit} />);

    await waitFor(() => screen.getByTestId('review-row-service'));
    const editServiceBtn = screen.getByRole('button', { name: /Editar Serviços/i });
    fireEvent.click(editServiceBtn);
    expect(onEdit).toHaveBeenCalledWith('service');
  });

  it('mostra mensagem de erro quando providers query falha', async () => {
    setProviderRpcError('boom');
    supabaseMock.from.mockImplementation((table: string) => {
      throw new Error(`unexpected ${table}`);
    });

    render(<Step22_Review onBack={vi.fn()} onFinalize={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('step22-error')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Tentar de novo/i })).toBeInTheDocument();
  });

  it('mostra lista detalhada de pendências (actions) quando há lacunas', async () => {
    setProviderRpcOk({
      id: 'p1',
      city: 'Curitiba',
      working_hours_struct: {},
      cpf: null,
      cnpj: null,
    });
    setFromTablesOnly(0, 0);

    render(<Step22_Review onBack={vi.fn()} onFinalize={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => screen.getByTestId('review-row-service'));

    const serviceActions = screen.getByTestId('review-actions-service');
    expect(serviceActions.textContent || '').toMatch(/Cadastre pelo menos 1 serviço/i);

    const photoActions = screen.getByTestId('review-actions-photos');
    expect(photoActions.textContent || '').toMatch(/Adicione pelo menos 1 foto/i);

    const extrasActions = screen.getByTestId('review-actions-extras');
    expect(extrasActions.textContent || '').toMatch(/horários de atendimento/i);

    const portfolioActions = screen.getByTestId('review-actions-portfolio');
    expect(portfolioActions.textContent || '').toMatch(/Crie 1 álbum/i);

    expect(document.body.textContent || '').toMatch(/ação|ações/i);
  });

  it('faz fallback para draft local quando providers query lança e draft existe', async () => {
    localStorage.setItem(
      'onboarding_v3_institutional_final',
      JSON.stringify({
        savedAt: Date.now(),
        profile: { city: 'Curitiba', cpf: '12345678901' },
        service: {
          name: 'Pintura',
          description: 'desc',
          gallery_urls: ['p1.jpg', 'p2.jpg'],
          cities_served: ['Curitiba', 'Pinhais'],
          working_hours_struct: { mon: { start: '09:00' } },
        },
      }),
    );
    setProviderRpcReject('Failed to fetch');
    supabaseMock.from.mockImplementation((table: string) => {
      throw new Error(`unexpected ${table}`);
    });

    render(<Step22_Review onBack={vi.fn()} onFinalize={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('step22-local-fallback')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('step22-error')).toBeNull();
    expect(screen.getByTestId('review-row-identity')).toBeInTheDocument();
    expect(screen.getByTestId('review-row-photos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finalizar cadastro/i })).toBeInTheDocument();
  });

  it('NÃO mostra banner de "rascunho desatualizado" só por idade — sem schemaVersion divergente', async () => {
    const oldSavedAt = Date.now() - 1000 * 60 * 60 * 26;
    localStorage.setItem(
      'onboarding_v3_institutional_final',
      JSON.stringify({
        savedAt: oldSavedAt,
        profile: { city: 'Curitiba' },
        service: { name: 'Pintura', gallery_urls: [] },
      }),
    );
    setProviderRpcReject('Failed to fetch');
    supabaseMock.from.mockImplementation((table: string) => {
      throw new Error(`unexpected ${table}`);
    });

    render(<Step22_Review onBack={vi.fn()} onFinalize={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('step22-local-fallback')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('step22-draft-outdated')).toBeNull();
  });

  it('mostra botões de copiar pendência por linha quando há ações pendentes', async () => {
    setProviderRpcOk({
      id: 'p1',
      city: 'Curitiba',
      working_hours_struct: {},
      cpf: null,
      cnpj: null,
    });
    setFromTablesOnly(0, 0);

    render(<Step22_Review onBack={vi.fn()} onFinalize={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => screen.getByTestId('review-row-service'));

    expect(screen.getByTestId('copy-pendency-service')).toBeInTheDocument();
    expect(screen.getByTestId('copy-pendency-photos')).toBeInTheDocument();
    expect(screen.getByTestId('step22-digest-actions')).toBeInTheDocument();
  });

  it('NÃO mostra banner "rascunho desatualizado" quando o draft local é recente', async () => {
    const recentSavedAt = Date.now() - 1000 * 60 * 5;
    localStorage.setItem(
      'onboarding_v3_institutional_final',
      JSON.stringify({
        savedAt: recentSavedAt,
        schemaVersion: 'v3.2026-05',
        profile: { city: 'Curitiba' },
        service: { name: 'Pintura', gallery_urls: [] },
      }),
    );
    setProviderRpcReject('Failed to fetch');
    supabaseMock.from.mockImplementation((table: string) => {
      throw new Error(`unexpected ${table}`);
    });

    render(<Step22_Review onBack={vi.fn()} onFinalize={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('step22-local-fallback')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('step22-draft-outdated')).toBeNull();
  });

  it('mostra banner "rascunho desatualizado" quando o schemaVersion difere', async () => {
    const recentSavedAt = Date.now() - 1000 * 60 * 5;
    localStorage.setItem(
      'onboarding_v3_institutional_final',
      JSON.stringify({
        savedAt: recentSavedAt,
        schemaVersion: 'v2.2025-01',
        profile: { city: 'Curitiba' },
        service: { name: 'Pintura', gallery_urls: [] },
      }),
    );
    setProviderRpcReject('Failed to fetch');
    supabaseMock.from.mockImplementation((table: string) => {
      throw new Error(`unexpected ${table}`);
    });

    render(<Step22_Review onBack={vi.fn()} onFinalize={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('step22-draft-outdated')).toBeInTheDocument();
    });
  });
});
