/**
 * Phase4ExtrasB — última etapa do onboarding V2 (redes sociais + concluir cadastro).
 *
 * Garante que:
 *   1. O CTA "Concluir cadastro" dispara onFinish (caminho feliz para /sucesso).
 *   2. O CTA "Pular e concluir" dispara onSkip (também leva ao sucesso).
 *   3. Os botões NÃO ficam travados quando saving=false.
 *   4. Quando saving=true, ambos ficam disabled e mostram spinner — mas nunca
 *      "engolem" o clique a ponto de o usuário ficar sem caminho de saída.
 *   5. O botão Voltar dispara onBack quando fornecido (não bloqueia retorno).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

function setup(overrides: { saving?: boolean; onFinish?: () => void; onSkip?: () => void; onBack?: () => void } = {}) {
  const onFinish = overrides.onFinish ?? vi.fn();
  const onSkip = overrides.onSkip ?? vi.fn();
  const onBack = overrides.onBack ?? vi.fn();
  const onChange = vi.fn();
  render(
    <Phase4ExtrasB
      data={baseData}
      onChange={onChange}
      onFinish={onFinish}
      onSkip={onSkip}
      onBack={onBack}
      saving={overrides.saving ?? false}
    />,
  );
  return { onFinish, onSkip, onBack, onChange };
}

describe('Phase4ExtrasB — finalização do wizard (redes sociais → sucesso)', () => {
  it('renderiza os CTAs principais ("Concluir cadastro" e "Pular e concluir")', () => {
    setup();
    expect(screen.getByRole('button', { name: /Concluir cadastro/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pular e concluir/i })).toBeTruthy();
  });

  it('clicar em "Concluir cadastro" dispara onFinish (rota para /onboarding-v2/sucesso)', () => {
    const { onFinish } = setup();
    const btn = screen.getByRole('button', { name: /Concluir cadastro/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false); // não pode estar travado quando saving=false
    fireEvent.click(btn);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('clicar em "Pular e concluir" também conclui o wizard (caminho de saída garantido)', () => {
    const { onSkip } = setup();
    const btn = screen.getByRole('button', { name: /Pular e concluir/i });
    fireEvent.click(btn);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('quando saving=true, ambos os CTAs ficam disabled (evita duplo submit), mas continuam montados', () => {
    setup({ saving: true });
    const finish = screen.getByRole('button', { name: /Concluir cadastro/i }) as HTMLButtonElement;
    const skip = screen.getByRole('button', { name: /Pular e concluir/i }) as HTMLButtonElement;
    expect(finish.disabled).toBe(true);
    expect(skip.disabled).toBe(true);
    // Garantia: o botão "Concluir" mostra o spinner — sinal visual de progresso, não de trava.
    expect(finish.querySelector('svg.animate-spin')).toBeTruthy();
  });

  it('botão "Voltar" chama onBack (usuário não fica preso na última fase)', () => {
    const { onBack } = setup();
    const back = screen.getByTestId('phase4-extras-b-back');
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('campos de redes sociais são opcionais — concluir funciona sem nenhum preenchido', () => {
    const { onFinish } = setup();
    // baseData tem instagram_url/facebook_url vazios. Se o CTA estivesse travado por
    // validação, este clique não chamaria onFinish.
    fireEvent.click(screen.getByRole('button', { name: /Concluir cadastro/i }));
    expect(onFinish).toHaveBeenCalled();
  });
});
