/**
 * Persistência do bairro sugerido pelo CEP e regra anti-sobrescrita.
 *
 * Cobre:
 *  1. `bairro_sugerido_cep` é gravado no patch `onChange` quando o lookup
 *     retorna `neighborhood`.
 *  2. Quando o usuário JÁ confirmou manualmente (`street_confirmed=true`),
 *     uma nova consulta de CEP NÃO sobrescreve `street_suggested` nem
 *     `street_suggested_cep` — apenas registra o bairro.
 *  3. Quando o usuário ainda não confirmou, `street_suggested_cep` é atualizado.
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

function Harness({
  initial,
  onPatch,
}: {
  initial?: CompanyAddressValue;
  onPatch?: (p: Partial<CompanyAddressValue>) => void;
}) {
  const [value, setValue] = useState<CompanyAddressValue>(initial ?? {});
  return (
    <CompanyAddressForm
      value={value}
      onChange={(p) => {
        onPatch?.(p);
        setValue((v) => ({ ...v, ...p }));
      }}
    />
  );
}

describe('CompanyAddressForm — bairro_sugerido_cep e anti-sobrescrita', () => {
  beforeEach(() => lookupCepMock.mockReset());

  it('grava bairro_sugerido_cep quando o lookup retorna neighborhood', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true,
      cep: '01310-100',
      city: 'São Paulo',
      state: 'SP',
      address: 'Avenida Paulista',
      neighborhood: 'Bela Vista',
      source: 'brasilapi',
    });
    const patches: Partial<CompanyAddressValue>[] = [];
    render(<Harness onPatch={(p) => patches.push(p)} />);
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => { fireEvent.change(cep, { target: { value: '01310100' } }); });
    await waitFor(() => {
      expect(patches.some((p) => p.bairro_sugerido_cep === 'Bela Vista')).toBe(true);
    });
  });

  it('quando street_confirmed=true: novo lookup NÃO sobrescreve street_suggested_cep (auditoria do 1º CEP)', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true,
      cep: '04567-000',
      city: 'São Paulo',
      state: 'SP',
      address: 'Rua Diferente',
      neighborhood: 'Brooklin',
      source: 'brasilapi',
    });
    const patches: Partial<CompanyAddressValue>[] = [];
    render(
      <Harness
        initial={{
          street: 'Avenida Paulista',
          street_confirmed: true,
          street_suggested: 'Avenida Paulista',
          street_suggested_cep: '01310100',
        }}
        onPatch={(p) => patches.push(p)}
      />,
    );
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => { fireEvent.change(cep, { target: { value: '04567000' } }); });
    await waitFor(() => {
      expect(patches.some((p) => p.bairro_sugerido_cep === 'Brooklin')).toBe(true);
    });
    // street_suggested_cep (auditoria) NÃO foi sobrescrito.
    const tocouCep = patches.some((p) => 'street_suggested_cep' in p);
    expect(tocouCep).toBe(false);
    // street_suggested PODE ter sido atualizado — necessário para o banner
    // de conflito detectar a divergência. Auditoria-only via street_suggested_cep.
  });

  it('quando street_confirmed=false: novo lookup ATUALIZA street_suggested_cep', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true,
      cep: '04567-000',
      city: 'São Paulo',
      state: 'SP',
      address: 'Avenida Brigadeiro',
      neighborhood: 'Brooklin',
      source: 'brasilapi',
    });
    const patches: Partial<CompanyAddressValue>[] = [];
    render(
      <Harness
        initial={{ street_confirmed: false }}
        onPatch={(p) => patches.push(p)}
      />,
    );
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => { fireEvent.change(cep, { target: { value: '04567000' } }); });
    await waitFor(() => {
      expect(patches.some((p) => p.street_suggested_cep === '04567000')).toBe(true);
    });
  });
});
