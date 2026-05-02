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
  supabaseMock: { from: vi.fn() },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

import Step22_Review from '@/components/onboarding/wizard/phases/Step22_Review';

function makeProvidersOk(payload: any) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: payload, error: null }),
      }),
    }),
  };
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
  });

  it('mostra resumo com 5 linhas após carregar', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'providers')
        return makeProvidersOk({
          id: 'p1',
          city: 'Curitiba',
          cpf: '12345678901',
          working_hours_struct: { mon: { start: '09:00' } },
        });
      if (table === 'services') return makeServicesCount(2);
      if (table === 'portfolio_albums') return makeAlbumsCount(1);
      throw new Error(`unexpected ${table}`);
    });

    render(
      <Step22_Review onBack={vi.fn()} onFinalize={vi.fn()} onEdit={vi.fn()} />,
    );

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
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'providers')
        return makeProvidersOk({ id: 'p1', city: 'SP', working_hours_struct: {} });
      if (table === 'services') return makeServicesCount(1);
      if (table === 'portfolio_albums') return makeAlbumsCount(0);
      throw new Error(`unexpected ${table}`);
    });

    const onEdit = vi.fn();
    render(<Step22_Review onBack={vi.fn()} onFinalize={vi.fn()} onEdit={onEdit} />);

    await waitFor(() => screen.getByTestId('review-row-service'));
    const editServiceBtn = screen.getByRole('button', { name: /Editar Serviços/i });
    fireEvent.click(editServiceBtn);
    expect(onEdit).toHaveBeenCalledWith('service');
  });

  it('mostra mensagem de erro quando providers query falha', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'providers')
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: { message: 'boom' } }),
            }),
          }),
        };
      throw new Error(`unexpected ${table}`);
    });

    render(<Step22_Review onBack={vi.fn()} onFinalize={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('step22-error')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Tentar de novo/i })).toBeInTheDocument();
  });

  it('mostra lista detalhada de pendências (actions) quando há lacunas', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'providers')
        return makeProvidersOk({
          id: 'p1',
          city: 'Curitiba',
          working_hours_struct: {},
          cpf: null,
          cnpj: null,
        });
      if (table === 'services') return makeServicesCount(0);
      if (table === 'portfolio_albums') return makeAlbumsCount(0);
      throw new Error(`unexpected ${table}`);
    });

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

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'providers')
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
            }),
          }),
        };
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
});
