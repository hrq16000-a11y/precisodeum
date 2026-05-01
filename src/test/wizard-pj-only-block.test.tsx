/**
 * Garante que o bloco opcional de endereço PJ:
 *  1. RENDERIZA quando state.pro_kind === 'pj'.
 *  2. NÃO RENDERIZA quando state.pro_kind === 'pf'.
 *  3. Mantém Logradouro e Número na MESMA linha (achatado) — uma única grid
 *     contém ambos os campos.
 *  4. Título reflete o tipo selecionado (CPF para PF, CNPJ para PJ).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PhaseProDocument from '@/components/onboarding/wizard/phases/bet/PhaseProDocument';
import type { BetState } from '@/components/onboarding/wizard/phases/bet/types';

function baseState(overrides: Partial<BetState> = {}): BetState {
  return {
    pro_kind: 'pj',
    document: '',
    company_name: '',
    street: '',
    street_number: '',
    complement: '',
    postal_code: '',
    show_full_address: false,
    city: 'São José dos Pinhais',
    state: 'PR',
    neighborhood: 'Itália',
    ...(overrides as any),
  } as BetState;
}

const noop = () => {};

describe('PhaseProDocument — visibilidade do bloco PJ', () => {
  it('RENDERIZA bloco de endereço quando pro_kind=pj', () => {
    render(
      <PhaseProDocument state={baseState({ pro_kind: 'pj' })} patch={noop} next={noop} addPoints={noop} />,
    );
    expect(screen.getByText(/Possui ponto de atendimento físico/i)).toBeTruthy();
  });

  it('NÃO RENDERIZA bloco de endereço quando pro_kind=pf', () => {
    render(
      <PhaseProDocument state={baseState({ pro_kind: 'pf' })} patch={noop} next={noop} addPoints={noop} />,
    );
    expect(screen.queryByText(/Possui ponto de atendimento físico/i)).toBeNull();
  });

  it('título e placeholder seguem o tipo: PF → CPF, PJ → CNPJ', () => {
    const { rerender } = render(
      <PhaseProDocument state={baseState({ pro_kind: 'pf' })} patch={noop} next={noop} addPoints={noop} />,
    );
    expect(screen.getByRole('heading').textContent).toMatch(/CPF/);
    expect(screen.getByPlaceholderText('000.000.000-00')).toBeTruthy();

    rerender(
      <PhaseProDocument state={baseState({ pro_kind: 'pj' })} patch={noop} next={noop} addPoints={noop} />,
    );
    expect(screen.getByRole('heading').textContent).toMatch(/CNPJ/);
    expect(screen.getByPlaceholderText('00.000.000/0000-00')).toBeTruthy();
  });

  it('Logradouro e Número ficam na MESMA grid achatada (grid-cols-[1fr_88px])', () => {
    const { container } = render(
      <PhaseProDocument
        state={baseState({ pro_kind: 'pj', street: 'Rua das Flores', street_number: '123' })}
        patch={noop}
        next={noop}
        addPoints={noop}
      />,
    );
    // A grid achatada deve estar no DOM.
    const grids = container.querySelectorAll('div.grid.grid-cols-\\[1fr_88px\\]');
    expect(grids.length).toBeGreaterThan(0);
    // E essa grid deve conter ambos os inputs de Logradouro (Rua/Avenida) e Número.
    const grid = grids[0] as HTMLElement;
    expect(grid.querySelector('input[placeholder="Rua / Avenida"]')).toBeTruthy();
    expect(grid.querySelector('input[placeholder="123"]')).toBeTruthy();
  });
});
