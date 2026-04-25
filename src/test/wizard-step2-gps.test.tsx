import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Step2Location } from '@/components/onboarding/SmartOnboardingWizard';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }) },
}));
vi.mock('@/components/AvatarUpload', () => ({ default: () => <div data-testid="avatar" /> }));

describe('Step 2 — GPS UX', () => {
  it('aciona o callback de GPS quando o usuário clica em "Usar GPS"', async () => {
    const onUsePreciseLocation = vi.fn().mockResolvedValue(undefined);
    render(
      <Step2Location
        city=""
        state=""
        avatarUrl={null}
        editingCity={false}
        onEditCity={vi.fn()}
        onCloseEditing={vi.fn()}
        onCityChange={vi.fn()}
        onAvatarChange={vi.fn()}
        onFieldBlur={vi.fn()}
        onUsePreciseLocation={onUsePreciseLocation}
        gpsLoading={false}
        geoStatusText="Defina sua localização"
        geoPrecise={false}
        geoFailed={false}
        geoSource="none"
        userId="user-1"
        onBack={vi.fn()}
        onNext={vi.fn()}
        onSkip={vi.fn()}
        canAdvance={false}
        fullName="Maria"
        socialAvatarUrl={null}
      />
    );

    const gpsBtn = screen.getByRole('button', { name: /usar gps/i });
    fireEvent.click(gpsBtn);

    await waitFor(() => expect(onUsePreciseLocation).toHaveBeenCalledTimes(1));
  });

  it('exibe a cidade selecionada como chip de confirmação após o GPS resolver', () => {
    render(
      <Step2Location
        city="Curitiba"
        state="PR"
        avatarUrl={null}
        editingCity={false}
        onEditCity={vi.fn()}
        onCloseEditing={vi.fn()}
        onCityChange={vi.fn()}
        onAvatarChange={vi.fn()}
        onFieldBlur={vi.fn()}
        onUsePreciseLocation={vi.fn()}
        gpsLoading={false}
        geoStatusText="Localização precisa ativa via GPS em Curitiba • PR"
        geoPrecise
        geoFailed={false}
        geoSource="gps"
        userId="user-1"
        onBack={vi.fn()}
        onNext={vi.fn()}
        onSkip={vi.fn()}
        canAdvance
        fullName="Maria"
        socialAvatarUrl={null}
      />
    );

    expect(screen.getAllByText(/localização precisa ativa/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Curitiba • PR/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /atualizar gps/i })).toBeInTheDocument();
  });
});
