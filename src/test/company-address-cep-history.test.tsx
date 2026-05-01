/**
 * Histórico recente de CEPs no CompanyAddressForm.
 *
 * Regras cobertas:
 *  - Após uma busca com sucesso, o item aparece em "CEPs recentes".
 *  - Após uma 2ª busca, o histórico mantém ordem LRU e máx 3 itens.
 *  - Clicar em um item do histórico reaplica CEP+logradouro num único patch
 *    e marca street_confirmed=false (usuário precisa reconfirmar).
 *  - O patch também repõe street_suggested_cep para auditoria/telemetria.
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

describe('CompanyAddressForm — histórico de CEPs e street_suggested_cep', () => {
  beforeEach(() => lookupCepMock.mockReset());

  it('persiste street_suggested_cep junto com a sugestão após lookup', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP',
      address: 'Avenida Paulista', source: 'brasilapi',
    });
    const patches: Partial<CompanyAddressValue>[] = [];
    render(<Harness onPatch={(p) => patches.push(p)} />);
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => { fireEvent.change(cep, { target: { value: '01310100' } }); });
    await waitFor(() => {
      expect(patches.some((p) => p.street_suggested_cep === '01310100')).toBe(true);
    });
    const patchWithCep = patches.find((p) => p.street_suggested_cep === '01310100')!;
    expect(patchWithCep.street_suggested).toBe('Avenida Paulista');
  });

  it('mostra item no histórico após sucesso e permite reaplicar com 1 clique', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP',
      address: 'Avenida Paulista', source: 'brasilapi',
    });
    render(<Harness />);
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => { fireEvent.change(cep, { target: { value: '01310100' } }); });
    await waitFor(() => expect(screen.getByTestId('cep-history')).toBeTruthy());

    // Apaga o CEP — confirma que o histórico permanece visível.
    await act(async () => { fireEvent.change(cep, { target: { value: '' } }); });
    expect(screen.getByTestId('cep-history')).toBeTruthy();

    // Clicar no item reaplica CEP+rua.
    const item = screen.getByTestId('cep-history-item-01310100');
    await act(async () => { fireEvent.click(item); });
    expect(cep.value).toBe('01310-100');
    const street = screen.getByPlaceholderText('Rua / Avenida') as HTMLInputElement;
    expect(street.value).toBe('Avenida Paulista');
  });

  it('mantém máx 3 itens no histórico em ordem LRU (mais recente primeiro)', async () => {
    lookupCepMock
      .mockResolvedValueOnce({ ok: true, cep: '01001-000', city: 'São Paulo', state: 'SP', address: 'Praça da Sé', source: 'brasilapi' })
      .mockResolvedValueOnce({ ok: true, cep: '04567-000', city: 'São Paulo', state: 'SP', address: 'Avenida Brigadeiro', source: 'brasilapi' })
      .mockResolvedValueOnce({ ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP', address: 'Avenida Paulista', source: 'brasilapi' })
      .mockResolvedValueOnce({ ok: true, cep: '20040-002', city: 'Rio de Janeiro', state: 'RJ', address: 'Rua da Carioca', source: 'brasilapi' });
    render(<Harness />);
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    const seq = ['01001000', '04567000', '01310100', '20040002'];
    for (const v of seq) {
      await act(async () => { fireEvent.change(cep, { target: { value: '' } }); });
      await act(async () => { fireEvent.change(cep, { target: { value: v } }); });
      // espera o lookup propagar
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() => expect(screen.getByTestId('cep-history')).toBeTruthy());
    }
    // Mais recente é o 20040-002; o mais antigo (01001-000) deve ter saído.
    expect(screen.getByTestId('cep-history-item-20040002')).toBeTruthy();
    expect(screen.getByTestId('cep-history-item-01310100')).toBeTruthy();
    expect(screen.getByTestId('cep-history-item-04567000')).toBeTruthy();
    expect(screen.queryByTestId('cep-history-item-01001000')).toBeNull();
  });

  it('reapply marca street_confirmed=false (usuário precisa reconfirmar)', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP',
      address: 'Avenida Paulista', source: 'brasilapi',
    });
    const patches: Partial<CompanyAddressValue>[] = [];
    render(<Harness onPatch={(p) => patches.push(p)} />);
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => { fireEvent.change(cep, { target: { value: '01310100' } }); });
    await waitFor(() => expect(screen.getByTestId('cep-history')).toBeTruthy());
    patches.length = 0;
    await act(async () => { fireEvent.click(screen.getByTestId('cep-history-item-01310100')); });
    const reapply = patches[patches.length - 1];
    expect(reapply.postal_code).toBe('01310100');
    expect(reapply.street).toBe('Avenida Paulista');
    expect(reapply.street_suggested_cep).toBe('01310100');
    expect(reapply.street_confirmed).toBe(false);
  });
});
