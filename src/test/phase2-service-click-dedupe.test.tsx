/**
 * Phase2Service — deduplicação de cliques no botão "Salvar e continuar".
 *
 * Garante que múltiplos cliques rápidos chamam `onNext` UMA ÚNICA VEZ enquanto
 * o lock interno (`advancingRef`) está ativo. Isso impede que o usuário dispare
 * múltiplas requisições ao banco ao bater no botão duas vezes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock do supabase para evitar chamada real à tabela `categories`.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({
          data: [{ id: 'cat-1', name: 'Encanador', icon: null }],
          error: null,
        }),
      }),
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { Phase2Service } from '@/components/onboarding/wizard/phases/v2/Phase2Service';

const baseProfile: any = {
  full_name: 'Test',
  whatsapp: '11999999999',
  city: 'Curitiba',
  state: 'PR',
  primary_category_id: 'cat-1',
  working_hours: '',
  kind: 'pf',
  document: '',
  avatar_url: null,
  years_experience: null,
  neighborhood: '',
  bio: '',
  instagram_url: '',
  facebook_url: '',
};

const baseService: any = {
  service_name: 'Encanador',
  description: 'Atendimento residencial e comercial com mais de 10 anos.',
  category_ids: ['cat-1'],
  cities_served: [],
  starting_price_brl: null,
  working_days: [],
  working_hours: '',
};

describe('Phase2Service — dedupe de clique no botão Salvar e continuar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('múltiplos cliques rápidos disparam onNext apenas UMA vez', async () => {
    const onNext = vi.fn();
    const onChangeService = vi.fn();
    const onChangeProfile = vi.fn();

    render(
      <Phase2Service
        service={baseService}
        profile={baseProfile}
        onChangeService={onChangeService}
        onChangeProfile={onChangeProfile}
        onNext={onNext}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        firstServiceId={null}
      />,
    );

    const btn = screen.getByRole('button', { name: /salvar e continuar/i });

    // Burst de cliques rápidos
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('libera o lock após 600ms permitindo novo clique', () => {
    const onNext = vi.fn();
    render(
      <Phase2Service
        service={baseService}
        profile={baseProfile}
        onChangeService={vi.fn()}
        onChangeProfile={vi.fn()}
        onNext={onNext}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        firstServiceId={null}
      />,
    );

    const btn = screen.getByRole('button', { name: /salvar e continuar/i });

    fireEvent.click(btn);
    fireEvent.click(btn); // ainda travado
    expect(onNext).toHaveBeenCalledTimes(1);

    // Avança o relógio do dedupe
    vi.advanceTimersByTime(700);

    fireEvent.click(btn);
    expect(onNext).toHaveBeenCalledTimes(2);
  });
});
