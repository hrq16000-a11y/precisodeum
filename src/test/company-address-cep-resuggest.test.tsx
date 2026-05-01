/**
 * Re-sugestão ao editar o CEP:
 *  - Se o usuário confirmou o logradouro (street_confirmed=true), uma nova
 *    busca de CEP NÃO sobrescreve o campo street — mas atualiza street_suggested
 *    para que o banner de conflito apareça quando difere.
 *  - Se o usuário NÃO confirmou e o street atual era exatamente a sugestão
 *    anterior, a nova busca substitui pelo novo logradouro.
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

describe('CompanyAddressForm — re-sugestão preservando confirmação', () => {
  beforeEach(() => lookupCepMock.mockReset());

  it('CEP confirmado anteriormente: nova busca NÃO sobrescreve street, mas dispara conflict banner', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP',
      address: 'Rua Nova', source: 'brasilapi',
    });
    render(
      <Harness initial={{
        street: 'Avenida Paulista',
        street_confirmed: true,
        street_suggested: 'Avenida Paulista',
        postal_code: '',
      }} />,
    );
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => { fireEvent.change(cep, { target: { value: '04567000' } }); });
    await waitFor(() => expect(screen.getByTestId('cep-conflict-banner')).toBeTruthy());
    const street = screen.getByPlaceholderText('Rua / Avenida') as HTMLInputElement;
    // Mantém o que o usuário tinha — não sobrescreve.
    expect(street.value).toBe('Avenida Paulista');
  });

  it('Não-confirmado e igual à sugestão anterior: nova busca SUBSTITUI pelo novo logradouro', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true, cep: '04567-000', city: 'São Paulo', state: 'SP',
      address: 'Rua Nova', source: 'brasilapi',
    });
    render(
      <Harness initial={{
        street: 'Avenida Antiga',
        street_confirmed: false,
        street_suggested: 'Avenida Antiga',
        postal_code: '',
      }} />,
    );
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => { fireEvent.change(cep, { target: { value: '04567000' } }); });
    await waitFor(() => {
      const street = screen.getByPlaceholderText('Rua / Avenida') as HTMLInputElement;
      expect(street.value).toBe('Rua Nova');
    });
  });
});
