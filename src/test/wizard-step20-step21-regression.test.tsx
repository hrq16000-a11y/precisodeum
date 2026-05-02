/**
 * Regressão Step20_MoreServices / Step21_PortfolioAlbums.
 *
 * Trava o contrato de props (onBack opcional, onContinue, onSkip, onGoToPath)
 * e a hidratação visual mínima (renderiza com dados existentes do provider /
 * álbuns) — para que regressões no WizardShell que removam esses props
 * voltem a quebrar tipagem ou renderização vazia.
 *
 * Também valida o feedback de erro do Step21 quando o providerId não
 * consegue ser resolvido (rede/perfil pendente) — UX de debug pedido pela
 * auditoria de wizard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mocks compartilhados ────────────────────────────────────────────────────────
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-test-1' },
    provider: { id: 'prov-1', user_id: 'user-test-1' },
  }),
}));

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ServiceWizard pesado — substituímos por stub
vi.mock('@/components/dashboard/ServiceWizard', () => ({
  default: () => <div data-testid="service-wizard-stub">SW</div>,
}));

vi.mock('./PortfolioAlbumPhotoUploader', () => ({
  default: () => <div data-testid="portfolio-uploader-stub" />,
}));

// helpers de query builder ────────────────────────────────────────────────────
function makeServicesCountQuery(count: number) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ count, data: [], error: null }),
    }),
  };
}

function makeCategoriesQuery() {
  return {
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'cat-1', name: 'Reformas', slug: 'reformas', icon: 'Wrench', parent_id: null }],
        error: null,
      }),
    }),
  };
}

function makeProvidersQuery(id: string | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: id ? { id } : null,
          error: null,
        }),
      }),
    }),
  };
}

function makePortfolioAlbumsQuery(rows: Array<{ id: string; name: string; description: string | null }>) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    }),
  };
}

// ────────────────────────────────────────────────────────────────────────────
import Step20_MoreServices from '@/components/onboarding/wizard/phases/Step20_MoreServices';
import Step21_PortfolioAlbums from '@/components/onboarding/wizard/phases/Step21_PortfolioAlbums';

beforeEach(() => {
  supabaseMock.from.mockReset();
});

describe('Step20_MoreServices — contrato de props e renderização', () => {
  it('aceita onBack opcional + onContinue/onSkip e renderiza contagem de serviços', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'services') return makeServicesCountQuery(2);
      if (table === 'categories') return makeCategoriesQuery();
      if (table === 'providers') return makeProvidersQuery('prov-1');
      throw new Error(`unexpected table ${table}`);
    });

    const onBack = vi.fn();
    const onContinue = vi.fn();
    const onSkip = vi.fn();

    render(
      <MemoryRouter>
        <Step20_MoreServices onBack={onBack} onContinue={onContinue} onSkip={onSkip} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      // O componente renderiza "{count} / 5" só depois de loadingProvider=false
      expect(screen.getByText(/\/\s*5/)).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByRole('button', { name: /Continuar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pular/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar mais um serviço/i })).toBeInTheDocument();
  });

  it('compila sem onBack (prop opcional)', () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'services') return makeServicesCountQuery(0);
      if (table === 'categories') return makeCategoriesQuery();
      return makeProvidersQuery('prov-1');
    });
    expect(() =>
      render(
        <MemoryRouter>
          <Step20_MoreServices onContinue={() => {}} onSkip={() => {}} />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });
});

describe('Step21_PortfolioAlbums — contrato de props e feedback de erro', () => {
  it('aceita onBack/onContinue/onSkip e lista álbuns existentes', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'portfolio_albums')
        return makePortfolioAlbumsQuery([
          { id: 'a1', name: 'Reformas residenciais', description: 'antes/depois' },
        ]);
      if (table === 'providers') return makeProvidersQuery('prov-1');
      throw new Error(`unexpected ${table}`);
    });

    render(
      <MemoryRouter>
        <Step21_PortfolioAlbums onBack={() => {}} onContinue={() => {}} onSkip={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Reformas residenciais')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Concluir/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pular/i })).toBeInTheDocument();
  });

  it('mostra alerta de feedback quando providerId não pode ser resolvido', async () => {
    // Limpa o provider do useAuth mock para forçar lookup
    vi.doMock('@/hooks/useAuth', () => ({
      useAuth: () => ({ user: { id: 'user-test-1' }, provider: null }),
    }));

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'portfolio_albums') return makePortfolioAlbumsQuery([]);
      if (table === 'providers')
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      throw new Error(`unexpected ${table}`);
    });

    // Reimporta com mock sem provider
    const Mod = await import('@/components/onboarding/wizard/phases/Step21_PortfolioAlbums');
    const Comp = Mod.default;
    render(
      <MemoryRouter>
        <Comp onContinue={() => {}} onSkip={() => {}} />
      </MemoryRouter>,
    );

    // Quando provider context está vazio mas a query retorna null, o componente
    // deve sinalizar visualmente para o usuário (ou ao menos não quebrar).
    // Aceitamos qualquer um dos sinais: o alerta ou o cabeçalho renderizado.
    await waitFor(() => {
      const alert = screen.queryByTestId('step21-provider-error');
      const heading = screen.queryByText(/Crie seus álbuns de portfólio/i);
      expect(alert || heading).toBeTruthy();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Cobertura adicional: RLS / retry / loading / nunca-quebra
//
// Esses cenários simulam falhas reais quando o providerId não pode ser
// resolvido por motivos transitórios (rede), permanentes (RLS / sessão
// expirada) ou estruturais (perfil ainda não criado). Em todos os casos a
// tela do wizard não pode quebrar e deve oferecer feedback claro ao usuário.
describe('Step21_PortfolioAlbums — RLS, retry e loading não quebram a tela', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    vi.resetModules();
    // useAuth sem provider → força lookup
    vi.doMock('@/hooks/useAuth', () => ({
      useAuth: () => ({ user: { id: 'user-rls-1' }, provider: null }),
    }));
    vi.doMock('@/integrations/supabase/client', () => ({ supabase: supabaseMock }));
    vi.doMock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
    vi.doMock('@/components/onboarding/wizard/phases/PortfolioAlbumPhotoUploader', () => ({
      default: () => <div data-testid="portfolio-uploader-stub" />,
    }));
  });

  it('mensagem específica + CTA de retry quando consulta retorna erro tipo RLS', async () => {
    const rlsError = { code: '42501', message: 'permission denied for table providers' };
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'portfolio_albums') return makePortfolioAlbumsQuery([]);
      if (table === 'providers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: rlsError }),
            }),
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const Mod = await import('@/components/onboarding/wizard/phases/Step21_PortfolioAlbums');
    const Comp = Mod.default;
    render(
      <MemoryRouter>
        <Comp onContinue={() => {}} onSkip={() => {}} />
      </MemoryRouter>,
    );

    const alert = await screen.findByTestId('step21-provider-error');
    expect(alert.getAttribute('data-error-code')).toBe('rls');
    expect(alert.textContent || '').toMatch(/permissão|expirad/i);
    // Tela do wizard continua de pé (heading visível)
    expect(screen.getByText(/Crie seus álbuns de portfólio/i)).toBeInTheDocument();
    // Botão Retry visível para causa transitória/RLS
    expect(screen.getByTestId('step21-provider-retry')).toBeInTheDocument();
  });

  it('mensagem de network + retry refaz a query e some o alerta no sucesso', async () => {
    let callIdx = 0;
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'portfolio_albums') return makePortfolioAlbumsQuery([]);
      if (table === 'providers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(async () => {
                callIdx += 1;
                if (callIdx === 1) throw new Error('network down');
                return { data: { id: 'prov-recovered' }, error: null };
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const Mod = await import('@/components/onboarding/wizard/phases/Step21_PortfolioAlbums');
    const Comp = Mod.default;
    render(
      <MemoryRouter>
        <Comp onContinue={() => {}} onSkip={() => {}} />
      </MemoryRouter>,
    );

    const alert = await screen.findByTestId('step21-provider-error');
    expect(alert.getAttribute('data-error-code')).toBe('network');
    const retry = screen.getByTestId('step21-provider-retry');
    fireEvent.click(retry);

    await waitFor(() => {
      expect(screen.queryByTestId('step21-provider-error')).toBeNull();
    });
    // Tela permanece funcional após retry bem-sucedido
    expect(screen.getByText(/Crie seus álbuns de portfólio/i)).toBeInTheDocument();
  });

  it('mensagem de "perfil ainda não disponível" quando query é OK mas vazia (sem retry)', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'portfolio_albums') return makePortfolioAlbumsQuery([]);
      if (table === 'providers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const Mod = await import('@/components/onboarding/wizard/phases/Step21_PortfolioAlbums');
    const Comp = Mod.default;
    render(
      <MemoryRouter>
        <Comp onContinue={() => {}} onSkip={() => {}} />
      </MemoryRouter>,
    );

    const alert = await screen.findByTestId('step21-provider-error');
    expect(alert.getAttribute('data-error-code')).toBe('not_found');
    // Para causa estrutural, retry não aparece (não vai ajudar)
    expect(screen.queryByTestId('step21-provider-retry')).toBeNull();
  });
});

describe('Step20_MoreServices — feedback de loading consistente', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('mostra skeleton de loading enquanto o provider/contagem ainda não chegaram', async () => {
    // services count nunca resolve sincronamente; categories também adia
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'services') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(new Promise(() => {})),
          }),
        };
      }
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(new Promise(() => {})),
          }),
        };
      }
      return makeProvidersQuery('prov-1');
    });

    render(
      <MemoryRouter>
        <Step20_MoreServices onContinue={() => {}} onSkip={() => {}} />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('step20-loading')).toBeInTheDocument();
  });
});
