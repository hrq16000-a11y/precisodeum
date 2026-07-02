/**
 * Teste de integração leve do ServiceWizard cobrindo:
 *  - providerId vazio → não crasha; cai em fallback async
 *  - modo edição (sem serviceNumber) → contagem expressa NÃO renderizada
 *  - modo criação (serviceNumber=2) → contagem expressa renderizada
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
    rpc: async () => ({ data: null, error: null }),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/dashboard/ServiceImageDragUploader', () => ({
  default: () => null,
}));
vi.mock('@/components/PhoneMaskedInput', () => ({
  default: () => null,
}));
vi.mock('@/components/CategoryIcon', () => ({ default: () => null }));

import ServiceWizard from '@/components/dashboard/ServiceWizard';

describe('ServiceWizard integration', () => {
  const baseProps = {
    userId: 'u-1',
    provider: { id: 'p-1', city: 'Curitiba', state: 'PR', neighborhood: 'Centro', slug: 'p1' } as any,
    categories: [] as any[],
    onComplete: vi.fn(),
    onCancel: vi.fn(),
  };

  const renderWizard = (props: any) =>
    render(
      <MemoryRouter>
        <ServiceWizard {...props} />
      </MemoryRouter>,
    );

  it('não crasha quando providerId vem vazio', () => {
    expect(() => renderWizard({ ...baseProps, providerId: '' })).not.toThrow();
    // Header sempre renderiza
    expect(screen.getByText(/Cadastro Express/i)).toBeInTheDocument();
  });

  it('modo edição (sem serviceNumber) — não renderiza contagem expressa', () => {
    renderWizard({ ...baseProps, providerId: 'p-1' });
    // Não deve mostrar "X/5"
    expect(screen.queryByLabelText(/Serviço \d+ de \d+/i)).toBeNull();
  });

  it('modo criação (serviceNumber=2) — renderiza badge X/5', () => {
    renderWizard({ ...baseProps, providerId: 'p-1', serviceNumber: 2, maxServices: 5 });
    expect(screen.getByLabelText(/Serviço 2 de 5/i)).toBeInTheDocument();
  });
});
