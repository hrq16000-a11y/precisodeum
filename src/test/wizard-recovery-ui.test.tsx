/**
 * Cobre StuckStepBanner + ReportWizardErrorButton + retry providerId.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: async () => ({ data: [], error: null }) }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'r-1' }, error: null }) }) }),
    }),
    rpc: async () => ({ data: null, error: null }),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import StuckStepBanner from '@/components/wizard/StuckStepBanner';
import ReportWizardErrorButton from '@/components/wizard/ReportWizardErrorButton';

const wrap = (ui: React.ReactNode) => <MemoryRouter>{ui}</MemoryRouter>;

describe('StuckStepBanner', () => {
  it('não renderiza quando não há campos faltantes', () => {
    const { container } = render(wrap(<StuckStepBanner missing={[]} />));
    expect(container.firstChild).toBeNull();
  });

  it('lista os campos faltantes e oferece link de status', () => {
    render(wrap(<StuckStepBanner missing={['Categoria', 'Cidade']} stepLabel="Identidade" />));
    expect(screen.getByText(/Falta pouco para avançar/i)).toBeInTheDocument();
    expect(screen.getByText(/Categoria, Cidade/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver status do cadastro/i })).toBeInTheDocument();
  });
});

describe('ReportWizardErrorButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza com label padrão e é clicável', () => {
    render(wrap(<ReportWizardErrorButton step="photos" />));
    expect(screen.getByRole('button', { name: /Reportar erro/i })).toBeEnabled();
  });
});
