/**
 * Regressão (2026-05-02): a fase Categoria/Descrição (Phase2Service) NUNCA
 * deve mostrar um botão secundário inferior do tipo "Salvar progresso e
 * configurar meu painel depois". O fluxo deve ser linear até a etapa de
 * Fotos. O CTA "Salvar e continuar" apenas avança para a próxima fase
 * interna do wizard via `onNext`, sem disparar finalização.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [{ id: 'c-1', name: 'Eletricista' }], error: null }),
      }),
    }),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/CityAutocomplete', () => ({ default: () => null }));

import { Phase2Service } from '@/components/onboarding/wizard/phases/v2/Phase2Service';
import type {
  OnboardingFirstServiceData,
  OnboardingProfileData,
} from '@/components/onboarding/wizard/phases/v2/types';

const baseService: OnboardingFirstServiceData = {
  service_name: 'Eletricista',
  description: 'Profissional com 10 anos de experiência atendendo emergências.',
  category_ids: ['c-1'],
  cities_served: [],
  starting_price_brl: null,
  working_days: [],
  working_hours: '',
  working_hours_struct: null,
};

const baseProfile: OnboardingProfileData = {
  profile_type: 'provider',
  kind: 'pf',
  full_name: 'Fulano',
  whatsapp: '',
  document: '',
  city: 'Curitiba',
  state: 'PR',
  avatar_url: null,
  years_experience: null,
  neighborhood: 'Centro',
  bio: '',
  instagram_url: '',
  facebook_url: '',
  website_url: '',
  primary_category_id: 'c-1',
  working_hours: '',
  go_online: true,
  avatar_source: null,
  avatar_seed: 0,
};

const renderPhase = (firstServiceId: string | null = null) => {
  const onNext = vi.fn();
  const onBack = vi.fn();
  const onSkip = vi.fn();
  render(
    <MemoryRouter>
      <Phase2Service
        service={baseService}
        profile={baseProfile}
        onChangeService={vi.fn()}
        onChangeProfile={vi.fn()}
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
        firstServiceId={firstServiceId}
      />
    </MemoryRouter>,
  );
  return { onNext, onBack, onSkip };
};

describe('Phase2Service — fluxo linear (sem CTA secundário inferior)', () => {
  it('NÃO renderiza o botão "Salvar progresso e configurar meu painel depois" mesmo com firstServiceId', () => {
    renderPhase('svc-1');
    expect(
      screen.queryByRole('button', { name: /Salvar progresso e configurar meu painel depois/i }),
    ).toBeNull();
  });

  it('NÃO renderiza o botão sem firstServiceId (caso novo cadastro)', () => {
    renderPhase(null);
    expect(
      screen.queryByRole('button', { name: /Salvar progresso e configurar meu painel depois/i }),
    ).toBeNull();
  });

  it('clicar em "Salvar e continuar" chama onNext (não onSkip)', () => {
    const { onNext, onSkip } = renderPhase('svc-1');
    const cta = screen.getByRole('button', { name: /Salvar e continuar/i });
    fireEvent.click(cta);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });
});
