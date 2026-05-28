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

// Phase1Action/Kind/Location/Contact REMOVIDOS em mai/2026 (consolidação Bet Mode).
// Esses passos eram duplicações da triagem; a a11y deles agora é coberta
// pelos testes do Bet Mode (PhaseWho, PhaseClientCity, PhaseProKind, PhaseProLocation).
import { Phase2Service } from '@/components/onboarding/wizard/phases/v2/Phase2Service';

const profileBase = {
  full_name: '', whatsapp: '', city: '', state: '', neighborhood: '',
  avatar_url: '', primary_category_id: '', working_hours: '',
} as any;

const serviceBase = {
  category_ids: [], service_name: '', description: '',
  cities_served: [], working_days: [], working_hours: '', starting_price_brl: null,
} as any;

describe('Wizard a11y — Phase2Service', () => {
  it('tem region rotulado por aria-labelledby', () => {
    // Contrato pós-PR consolidação: o botão "Voltar" foi removido das fases
    // individuais — agora é provido globalmente pelo WizardNav (WizardShell).
    // A a11y de back é coberta pelo teste do WizardNav. Aqui só validamos o
    // landmark da fase em si.
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
  });
});
