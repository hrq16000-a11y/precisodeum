/**
 * Confirmação explícita do logradouro sugerido pelo CEP, conflito e retry.
 *
 * Cobre as regras da rodada V3 do CompanyAddressForm:
 *  - Lookup só dispara ao atingir EXATAMENTE 8 dígitos.
 *  - Máscara 00000-000 é aplicada visualmente em <8 dígitos sem disparar lookup.
 *  - Quando o CEP retorna logradouro e o campo está vazio, surge o banner
 *    "Sugerido pelo CEP — confirme" com botões "Usar este" / "Editar manualmente".
 *  - "Usar este" persiste { street, street_confirmed: true }.
 *  - Se o usuário já digitou logradouro diferente do sugerido, surge o banner
 *    de conflito com "Usar a do CEP" / "Manter o que digitei".
 *  - Falha de rede mostra mensagem clara + botão "Tentar de novo" que dispara
 *    novamente o lookup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useState } from 'react';
import CompanyAddressForm, {
  type CompanyAddressValue,
} from '@/components/company/CompanyAddressForm';

// Mocka lookupCep — controle por teste via mockImplementationOnce.
vi.mock('@/lib/cepLookup', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cepLookup')>('@/lib/cepLookup');
  return {
    ...actual,
    lookupCep: vi.fn(),
  };
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

describe('CompanyAddressForm — sugestão por CEP, confirmação e retry', () => {
  beforeEach(() => {
    lookupCepMock.mockReset();
  });

  it('máscara 00000-000 é aplicada e lookup NÃO dispara com menos de 8 dígitos', async () => {
    render(<Harness />);
    const cepInput = screen.getByPlaceholderText('00000-000') as HTMLInputElement;

    fireEvent.change(cepInput, { target: { value: '0131' } });
    expect(cepInput.value).toBe('0131'); // <=5 sem hífen
    fireEvent.change(cepInput, { target: { value: '01310' } });
    expect(cepInput.value).toBe('01310');
    fireEvent.change(cepInput, { target: { value: '0131010' } });
    expect(cepInput.value).toBe('01310-10'); // hífen depois do 5º
    // Em nenhum momento o lookup foi chamado.
    expect(lookupCepMock).not.toHaveBeenCalled();
  });

  it('lookup dispara EXATAMENTE com 8 dígitos e sugere logradouro com banner de confirmação', async () => {
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

    // Banner de sugestão pendente surge.
    await waitFor(() => {
      expect(screen.getByTestId('cep-suggestion-banner')).toBeTruthy();
    });
    expect(screen.getByText(/Avenida Paulista/)).toBeTruthy();
  });

  it('clicar "Usar este" confirma a sugestão e remove o banner', async () => {
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
    const accept = await screen.findByTestId('cep-suggestion-accept');
    fireEvent.click(accept);
    // Após confirmar, o banner some e o input do logradouro contém o valor.
    expect(screen.queryByTestId('cep-suggestion-banner')).toBeNull();
    const street = screen.getByPlaceholderText('Rua / Avenida') as HTMLInputElement;
    expect(street.value).toBe('Avenida Paulista');
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
    // Estado inicial: usuário JÁ digitou outra rua.
    render(<Harness initial={{ street: 'Rua das Flores', street_confirmed: true }} />);
    const cepInput = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(cepInput, { target: { value: '01310100' } });
    });
    const conflict = await screen.findByTestId('cep-conflict-banner');
    expect(conflict).toBeTruthy();
    expect(screen.getByText(/Rua das Flores/)).toBeTruthy();
    // E o banner de "sugestão pendente" NÃO aparece quando há conflito.
    expect(screen.queryByTestId('cep-suggestion-banner')).toBeNull();

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
    // Badge + caixa explicativa devem aparecer.
    const badge = await screen.findByTestId('cep-error-badge');
    expect(badge.textContent).toMatch(/Falha de rede/i);
    expect(screen.getByText(/Não conseguimos consultar o CEP/i)).toBeTruthy();

    // Próximo lookup retorna sucesso.
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
      expect(screen.getByTestId('cep-suggestion-banner')).toBeTruthy();
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
