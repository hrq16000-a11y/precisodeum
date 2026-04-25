import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Step2Location, Step3Contact } from '@/components/onboarding/SmartOnboardingWizard';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  },
}));

vi.mock('@/components/AvatarUpload', () => ({
  default: () => <div data-testid="avatar-upload" />,
}));

describe('Wizard Step 2 e Step 3 — regressões de fluidez', () => {
  it('Step 2 mostra a cidade selecionada e oferece ação de GPS', () => {
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
        geoStatusText="Cidade pronta para uso"
        geoPrecise={false}
        geoFailed={false}
        geoSource="manual"
        userId="user-1"
        onBack={vi.fn()}
        onNext={vi.fn()}
        onSkip={vi.fn()}
        canAdvance
        fullName="Maria"
        socialAvatarUrl={null}
      />
    );

    expect(screen.getAllByText(/Curitiba • PR/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /usar gps/i })).toBeInTheDocument();
  });

  it('Step 3 exibe a especialidade selecionada com clareza', () => {
    const onToggleCategory = vi.fn();
    render(
      <Step3Contact
        profileType="provider"
        providerSubtype="autonomous"
        setProviderSubtype={vi.fn()}
        fullName="Maria Silva"
        setFullName={vi.fn()}
        agencyName=""
        setAgencyName={vi.fn()}
        whatsapp="41999999999"
        setWhatsapp={vi.fn()}
        bio=""
        setBio={vi.fn()}
        taxId=""
        setTaxId={vi.fn()}
        taxSavedFeedback={false}
        categoriesForPicker={[{ id: '1', name: 'Eletricista' }]}
        selectedCategoryIds={['1']}
        onToggleCategory={onToggleCategory}
        saving={false}
        canAdvance
        onBack={vi.fn()}
        onNext={vi.fn()}
        onSkip={vi.fn()}
        onFieldBlur={vi.fn()}
      />
    );

    expect(screen.getByText(/qual é o principal serviço que você vai cadastrar/i)).toBeInTheDocument();
    expect(screen.getByText(/selecionado: eletricista/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/eletricista/i));
    expect(onToggleCategory).not.toHaveBeenCalled();
  });
});