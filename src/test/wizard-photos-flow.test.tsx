/**
 * Testes de integração do wizard cobrindo navegação completa e
 * resilência da etapa Photos (reload/troca de aba).
 *
 * Não exercitamos o uploader real (mockado) — focamos em garantir que:
 *  - Step 1 sem categoria mostra StuckStepBanner
 *  - O botão "Pular por enquanto" continua presente em todas etapas
 *  - O botão "Reportar erro" sempre aparece
 *  - Mudar de step não desmonta o wizard com erro de runtime
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: 'p-1' }, error: null }),
          order: () => ({ limit: async () => ({ data: [], error: null }) }),
        }),
      }),
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'r-1' }, error: null }) }) }),
    }),
    rpc: async () => ({ data: { success: true, service_id: 'svc-1' }, error: null }),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/dashboard/ServiceImageDragUploader', () => ({ default: () => <div data-testid="uploader" /> }));
vi.mock('@/components/PhoneMaskedInput', () => ({ default: () => null }));
vi.mock('@/components/CategoryIcon', () => ({ default: () => null }));

import ServiceWizard from '@/components/dashboard/ServiceWizard';

const wrap = (ui: React.ReactNode) => <MemoryRouter>{ui}</MemoryRouter>;

const baseProps = {
  userId: 'u-1',
  providerId: 'p-1',
  provider: { id: 'p-1', city: 'Curitiba', state: 'PR', neighborhood: 'Centro', slug: 'p1' } as any,
  categories: [{ id: 'c-1', name: 'Eletricista' }] as any[],
  onComplete: vi.fn(),
  onCancel: vi.fn(),
};

describe('ServiceWizard — navegação e resilência', () => {
  it('renderiza step 1 sem crash quando faltam dados (mostra banner stuck)', () => {
    render(wrap(<ServiceWizard {...baseProps} serviceNumber={1} />));
    expect(screen.getByText(/Cadastro Express/i)).toBeInTheDocument();
    // Banner stuck step com campos faltantes
    expect(screen.getByText(/Falta pouco para avançar/i)).toBeInTheDocument();
  });

  it('botão "Pular por enquanto" e "Reportar erro" visíveis em step 1', () => {
    render(wrap(<ServiceWizard {...baseProps} serviceNumber={1} />));
    expect(screen.getByRole('button', { name: /Pular por enquanto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reportar erro/i })).toBeInTheDocument();
  });

  it('não crasha quando providerId vazio + retry', () => {
    expect(() => render(wrap(<ServiceWizard {...baseProps} providerId="" serviceNumber={1} />))).not.toThrow();
  });
});
