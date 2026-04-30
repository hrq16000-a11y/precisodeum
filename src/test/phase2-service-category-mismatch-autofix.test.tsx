/**
 * Phase2Service — auto-correção de divergência categoria × service_name.
 *
 * Cenário G13:
 *   - Usuário selecionou a categoria "Encanador" (id=cat-1).
 *   - Por algum motivo o service_name local diverge ("Pintor") OU o
 *     primary_category_id do perfil não bate com a categoria.
 *
 * Comportamento esperado:
 *   - O botão "Salvar e continuar" continua CLICÁVEL (não trava sem explicação).
 *   - Ao clicar, o componente dispara `onChangeService` com category_ids+name
 *     alinhados E `onChangeProfile` com primary_category_id alinhado, ANTES
 *     de chamar `onNext`. Isso garante que o serviço é salvo coerente.
 *   - Um aviso inline informa que o título será ajustado.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({
          data: [
            { id: 'cat-1', name: 'Encanador', icon: null },
            { id: 'cat-2', name: 'Pintor', icon: null },
          ],
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
  // Divergência: perfil aponta para cat-2 (Pintor) mas o service tem cat-1 (Encanador)
  primary_category_id: 'cat-2',
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

const divergentService: any = {
  service_name: 'Pintor',                 // ← desalinhado da categoria escolhida
  description: 'Texto descritivo válido com mais de dez caracteres.',
  category_ids: ['cat-1'],                 // ← Encanador
  cities_served: [],
  starting_price_brl: null,
  working_days: [],
  working_hours: '',
};

describe('Phase2Service — auto-correção de divergência categoria/nome (G13)', () => {
  it('botão NÃO fica travado quando há divergência (UX: não bloquear sem explicar)', () => {
    render(
      <Phase2Service
        service={divergentService}
        profile={baseProfile}
        onChangeService={vi.fn()}
        onChangeProfile={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        firstServiceId={null}
      />,
    );
    const btn = screen.getByRole('button', { name: /salvar e continuar/i });
    // O botão usa aria-disabled, NÃO disabled — fica clicável para feedback.
    expect(btn).not.toHaveAttribute('disabled');
  });

  it('aviso inline informa que o título será ajustado', async () => {
    render(
      <Phase2Service
        service={divergentService}
        profile={baseProfile}
        onChangeService={vi.fn()}
        onChangeProfile={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        firstServiceId={null}
      />,
    );
    // Aguarda categorias carregarem para que selectedName seja resolvido.
    await screen.findByText(/título do serviço será ajustado/i);
  });

  it('ao avançar com divergência, alinha service_name + primary_category_id antes de chamar onNext', async () => {
    const onNext = vi.fn();
    const onChangeService = vi.fn();
    const onChangeProfile = vi.fn();

    render(
      <Phase2Service
        service={divergentService}
        profile={baseProfile}
        onChangeService={onChangeService}
        onChangeProfile={onChangeProfile}
        onNext={onNext}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        firstServiceId={null}
      />,
    );
    // Garante que as categorias carregaram (selectedName deriva delas)
    await screen.findByText(/título do serviço será ajustado/i);

    fireEvent.click(screen.getByRole('button', { name: /salvar e continuar/i }));

    // 1) Patch de service alinha category_ids[0]=cat-1 e service_name=Encanador
    const svcCalls = onChangeService.mock.calls.map((c) => c[0]);
    const svcAlign = svcCalls.find(
      (p: any) => p.category_ids?.[0] === 'cat-1' && p.service_name === 'Encanador',
    );
    expect(svcAlign).toBeTruthy();

    // 2) Patch de profile alinha primary_category_id=cat-1
    const profCalls = onChangeProfile.mock.calls.map((c) => c[0]);
    const profAlign = profCalls.find((p: any) => p.primary_category_id === 'cat-1');
    expect(profAlign).toBeTruthy();

    // 3) onNext foi chamado (avança apesar da divergência)
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
