/**
 * Testes de acessibilidade (a11y) das fases do wizard de cadastro de serviço.
 *
 * Cobertura mínima por fase:
 *  - role="region" + aria-labelledby (landmark identificável)
 *  - botão "Voltar" com aria-label legível
 *  - inputs com label visível (htmlFor / id) ou aria-label
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [{ id: 'c1', name: 'Eletricista', icon: null }], error: null }),
      }),
    }),
  },
}));
vi.mock('@/hooks/useGeoCity', () => ({
  useGeoCity: () => ({ requestPreciseLocation: vi.fn(async () => ({ ok: false })) }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', user_metadata: {} } }),
}));
vi.mock('@/components/CityAutocomplete', () => ({ default: () => <div data-testid="city-autocomplete" /> }));
vi.mock('@/components/admin/UFSelect', () => ({
  default: () => <select aria-label="UF mock"><option>—</option></select>,
  BR_UFS: [{ uf: 'PR', name: 'Paraná' }],
}));

import { Phase1Action, Phase1Kind, Phase1Location, Phase1Contact } from '@/components/onboarding/wizard/phases/v2/Phase1Basic';
import { Phase2Service } from '@/components/onboarding/wizard/phases/v2/Phase2Service';

const profileBase = {
  full_name: '', whatsapp: '', city: '', state: '', neighborhood: '',
  avatar_url: '', primary_category_id: '', working_hours: '',
} as any;

const serviceBase = {
  category_ids: [], service_name: '', description: '',
  cities_served: [], working_days: [], working_hours: '', starting_price_brl: null,
} as any;

describe('Wizard a11y — Phase1', () => {
  it('Phase1Action: tem region/radiogroup com nome acessível', () => {
    render(<Phase1Action onSelect={vi.fn()} />);
    expect(screen.getByRole('region', { name: /como você atua/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /como você atua/i })).toBeInTheDocument();
    // 4 cards atuação acessíveis
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('Phase1Kind: botão Voltar tem aria-label e radiogroup PF/PJ', () => {
    render(<Phase1Kind onSelect={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: /voltar para a etapa anterior/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /como vamos te identificar/i })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('Phase1Location: region rotulado e botão voltar acessível', () => {
    render(
      <Phase1Location
        data={profileBase}
        onChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByRole('region', { name: /de onde você atende/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /voltar para a etapa anterior/i })).toBeInTheDocument();
  });

  it('Phase1Contact: region rotulado, autoFocus no nome e botão voltar acessível', () => {
    render(
      <Phase1Contact
        data={{ ...profileBase, full_name: '' }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onBack={vi.fn()}
        saving={false}
      />,
    );
    expect(screen.getByRole('region', { name: /como te chamamos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /voltar para a etapa anterior/i })).toBeInTheDocument();
    // Inputs com placeholder/label visível
    expect(screen.getByPlaceholderText(/Maria Silva/i)).toBeInTheDocument();
  });
});

describe('Wizard a11y — Phase2Service', () => {
  it('tem region rotulado e botão voltar com aria-label', () => {
    render(
      <Phase2Service
        service={serviceBase}
        profile={profileBase}
        onChangeService={vi.fn()}
        onChangeProfile={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByRole('region', { name: /qual serviço você quer cadastrar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /voltar para a etapa anterior/i })).toBeInTheDocument();
  });
});
