/**
 * Phase4ExtrasB — resumo de endereço PJ aparece somente quando:
 *   - data.kind === 'pj' E
 *   - há ao menos um campo de endereço preenchido (street/number/postal_code/complement).
 * Caso contrário (PF, ou PJ sem endereço), o card pj-address-review NÃO renderiza.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Phase4ExtrasB } from '@/components/onboarding/wizard/phases/v2/Phase4Final';
import type { OnboardingProfileData } from '@/components/onboarding/wizard/phases/v2/types';

const baseData: OnboardingProfileData = {
  full_name: 'Teste',
  email: 'a@b.com',
  whatsapp: '11999999999',
  city: 'São Paulo',
  state: 'SP',
  neighborhood: 'Centro',
  bio: '',
  years_experience: null as any,
  document: '',
  kind: 'pf',
  avatar_url: '',
  instagram_url: '',
  facebook_url: '',
  street: '',
  street_number: '',
  complement: '',
  postal_code: '',
  show_full_address: false,
  street_suggested: '',
  street_confirmed: false,
} as unknown as OnboardingProfileData;

const noop = () => {};

function renderPhase(data: Partial<OnboardingProfileData>) {
  return render(
    <Phase4ExtrasB
      data={{ ...baseData, ...data } as OnboardingProfileData}
      onChange={noop}
      onFinish={noop}
      onSkip={noop}
      saving={false}
    />,
  );
}

describe('Phase4ExtrasB — pj-address-review', () => {
  it('PF (kind=pf) NÃO mostra o resumo, mesmo com endereço preenchido', () => {
    renderPhase({ kind: 'pf' as any, street: 'Rua A', street_number: '10' });
    expect(screen.queryByTestId('pj-address-review')).toBeNull();
  });

  it('PJ sem nenhum dado de endereço NÃO mostra o resumo', () => {
    renderPhase({ kind: 'pj' as any });
    expect(screen.queryByTestId('pj-address-review')).toBeNull();
  });

  it('PJ com street preenchido mostra o resumo', () => {
    renderPhase({ kind: 'pj' as any, street: 'Avenida Paulista' });
    expect(screen.getByTestId('pj-address-review')).toBeTruthy();
    expect(screen.getByText(/Avenida Paulista/)).toBeTruthy();
  });

  it('PJ com apenas postal_code mostra o resumo', () => {
    renderPhase({ kind: 'pj' as any, postal_code: '01310100' });
    expect(screen.getByTestId('pj-address-review')).toBeTruthy();
  });

  it('PJ com apenas complement mostra o resumo', () => {
    renderPhase({ kind: 'pj' as any, complement: 'Sala 12' });
    expect(screen.getByTestId('pj-address-review')).toBeTruthy();
  });

  it('PJ com show_full_address=true exibe mensagem de visibilidade pública', () => {
    renderPhase({ kind: 'pj' as any, street: 'Rua A', show_full_address: true });
    expect(screen.getByText(/exibido publicamente/i)).toBeTruthy();
  });

  it('PJ com show_full_address=false exibe mensagem de oculto', () => {
    renderPhase({ kind: 'pj' as any, street: 'Rua A', show_full_address: false });
    expect(screen.getByText(/Ficará oculto/i)).toBeTruthy();
  });
});
