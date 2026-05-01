/**
 * Lookup automático do CEP, conflito com o que o usuário digitou e retry.
 *
 * UI atualizada: a faixa "Sugerido pelo CEP — confirme" foi removida.
 * Comportamento atual:
 *  - Lookup só dispara ao atingir EXATAMENTE 8 dígitos.
 *  - Máscara 00000-000 é aplicada visualmente em <8 dígitos sem disparar lookup.
 *  - Quando o CEP retorna logradouro e o campo street está vazio, o valor é
 *    preenchido automaticamente e uma linha sutil mostra o nome da rua.
 *  - Quando o usuário JÁ digitou logradouro diferente, surge o banner de
 *    conflito com "Usar a do CEP" / "Manter o que digitei".
 *  - Falha de rede e CEP não encontrado mostram mensagens distintas + retry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useState } from 'react';
import CompanyAddressForm, {
  type CompanyAddressValue,
} from '@/components/company/CompanyAddressForm';

vi.mock('@/lib/cepLookup', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cepLookup')>('@/lib/cepLookup');
  return { ...actual, lookupCep: vi.fn() };
});

import { lookupCep } from '@/lib/cepLookup';
const lookupCepMock = lookupCep as unknown as ReturnType<typeof vi.fn>;

function Harness({ initial }: { initial?: CompanyAddressValue }) {
  const [value, setValue] = useState<CompanyAddressValue>(initial ?? {});
  return (
    <CompanyAddressForm
      value={value}
      onChange={(p) => setValue((v) => ({ ...v, ...p }))}
    />
  );
}

describe('CompanyAddressForm — lookup automático e conflitos', () => {
  beforeEach(() => {
    lookupCepMock.mockReset();
  });

  it('máscara 00000-000 é aplicada e lookup NÃO dispara com menos de 8 dígitos', async () => {
    render(<Harness />);
    const cepInput = screen.getByPlaceholderText('00000-000') as HTMLInputElement;

    fireEvent.change(cepInput, { target: { value: '0131' } });
    expect(cepInput.value).toBe('0131');
    fireEvent.change(cepInput, { target: { value: '01310' } });
    expect(cepInput.value).toBe('01310');
    fireEvent.change(cepInput, { target: { value: '0131010' } });
    expect(cepInput.value).toBe('01310-10');
    expect(lookupCepMock).not.toHaveBeenCalled();
  });

  it('lookup dispara com 8 dígitos e preenche street + mostra linha sutil com a rua', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true,
      cep: '01310-100',
      city: 'São Paulo',
      state: 'SP',
      address: 'Avenida Paulista',
      source: 'brasilapi',
    });
    render(<Harness />);
    const cepInput = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(cepInput, { target: { value: '01310100' } });
    });
    expect(lookupCepMock).toHaveBeenCalledTimes(1);
    expect(cepInput.value).toBe('01310-100');

    // A NOVA UI substitui o banner por uma linha sutil + auto-preenchimento.
    await waitFor(() => {
      expect(screen.getByTestId('cep-applied-street')).toBeTruthy();
    });
    expect(screen.getByTestId('cep-applied-street').textContent).toMatch(/Avenida Paulista/);
    const street = screen.getByPlaceholderText('Rua / Avenida') as HTMLInputElement;
    expect(street.value).toBe('Avenida Paulista');

    // O banner "Sugerido pelo CEP — confirme" foi removido.
    expect(screen.queryByTestId('cep-suggestion-banner')).toBeNull();
    expect(screen.queryByTestId('cep-suggestion-accept')).toBeNull();
  });

  it('detecta CONFLITO quando o usuário digitou street diferente do CEP sugerido', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true,
      cep: '01310-100',
      city: 'São Paulo',
      state: 'SP',
      address: 'Avenida Paulista',
      source: 'brasilapi',
    });
    render(<Harness initial={{ street: 'Rua das Flores', street_confirmed: true }} />);
    const cepInput = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(cepInput, { target: { value: '01310100' } });
    });
    const conflict = await screen.findByTestId('cep-conflict-banner');
    expect(conflict).toBeTruthy();
    expect(screen.getByText(/Rua das Flores/)).toBeTruthy();

    // "Usar a do CEP" substitui o que estava digitado.
    fireEvent.click(screen.getByTestId('cep-conflict-accept-suggestion'));
    const street = screen.getByPlaceholderText('Rua / Avenida') as HTMLInputElement;
    expect(street.value).toBe('Avenida Paulista');
  });

  it('falha de rede mostra mensagem clara + botão "Tentar de novo" que repete o lookup', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: false,
      reason: 'network',
      message: 'fail',
    });
    render(<Harness />);
    const cepInput = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(cepInput, { target: { value: '01310100' } });
    });
    const badge = await screen.findByTestId('cep-error-badge');
    expect(badge.textContent).toMatch(/Falha de rede/i);
    expect(screen.getByText(/Não conseguimos consultar o CEP/i)).toBeTruthy();

    lookupCepMock.mockResolvedValueOnce({
      ok: true,
      cep: '01310-100',
      city: 'São Paulo',
      state: 'SP',
      address: 'Avenida Paulista',
      source: 'viacep',
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('cep-retry'));
    });
    expect(lookupCepMock).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(screen.getByTestId('cep-applied-street')).toBeTruthy();
    });
  });

  it('CEP não encontrado tem mensagem distinta da falha de rede', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: false,
      reason: 'not_found',
      message: 'cep não cadastrado',
    });
    render(<Harness />);
    const cepInput = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(cepInput, { target: { value: '99999998' } });
    });
    const badge = await screen.findByTestId('cep-error-badge');
    expect(badge.textContent).toMatch(/CEP não encontrado/i);
    expect(screen.getByText(/Não encontramos esse CEP/i)).toBeTruthy();
  });
});
