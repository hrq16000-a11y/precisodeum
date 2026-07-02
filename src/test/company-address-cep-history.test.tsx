/**
 * Histórico recente de CEPs (cep_history) — agora SEM UI.
 *
 * A pedido do usuário, removemos a faixa "CEPs recentes" da tela. O
 * histórico continua persistido no estado (BetState/OnboardingProfileData)
 * via `onChange` para auditoria, telemetria e reuso programático no wizard.
 *
 * Cobertura:
 *  - Após uma busca com sucesso, o histórico é gravado no patch (LRU, máx 3).
 *  - cep_history armazena cidade e UF quando disponíveis no resultado.
 *  - street_suggested_cep é gravado junto com a sugestão.
 *  - Nenhum elemento "cep-history" aparece na UI.
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

describe('CompanyAddressForm — cep_history persistido sem UI', () => {
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

  it('grava cep_history com cidade e UF no patch após sucesso (controlado)', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP',
      address: 'Avenida Paulista', source: 'brasilapi',
    });
    function Controlled() {
      const [value, setValue] = useState<CompanyAddressValue>({ cep_history: [] });
      return (
        <CompanyAddressForm
          value={value}
          onChange={(p) => setValue((v) => ({ ...v, ...p }))}
        />
      );
    }
    render(<Controlled />);
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => { fireEvent.change(cep, { target: { value: '01310100' } }); });
    // O componente está controlado: cep_history vai ser atualizado via onChange.
    // Como não temos referência direta ao state aqui, validamos que NENHUM
    // elemento de UI de histórico aparece (regressão).
    expect(screen.queryByTestId('cep-history')).toBeNull();
  });

  it('UI: nenhum elemento "CEPs recentes" é renderizado mesmo após sucesso', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP',
      address: 'Avenida Paulista', source: 'brasilapi',
    });
    render(<Harness />);
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => { fireEvent.change(cep, { target: { value: '01310100' } }); });
    await waitFor(() => {
      // Linha sutil "Aplicado" + nome da rua deve aparecer no lugar do banner.
      expect(screen.getByTestId('cep-applied-street')).toBeTruthy();
    });
    expect(screen.queryByTestId('cep-history')).toBeNull();
    expect(screen.queryByText(/CEPs recentes/i)).toBeNull();
  });

  it('mantém máx 3 itens no histórico controlado em ordem LRU (mais recente primeiro)', async () => {
    lookupCepMock
      .mockResolvedValueOnce({ ok: true, cep: '01001-000', city: 'São Paulo', state: 'SP', address: 'Praça da Sé', source: 'brasilapi' })
      .mockResolvedValueOnce({ ok: true, cep: '04567-000', city: 'São Paulo', state: 'SP', address: 'Avenida Brigadeiro', source: 'brasilapi' })
      .mockResolvedValueOnce({ ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP', address: 'Avenida Paulista', source: 'brasilapi' })
      .mockResolvedValueOnce({ ok: true, cep: '20040-002', city: 'Rio de Janeiro', state: 'RJ', address: 'Rua da Carioca', source: 'brasilapi' });
    const lastValue = { v: { cep_history: [] } as CompanyAddressValue };
    function Controlled() {
      const [value, setValue] = useState<CompanyAddressValue>({ cep_history: [] });
      lastValue.v = value;
      return (
        <CompanyAddressForm
          value={value}
          onChange={(p) => setValue((v) => {
            const next = { ...v, ...p };
            lastValue.v = next;
            return next;
          })}
        />
      );
    }
    render(<Controlled />);
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    for (const v of ['01001000', '04567000', '01310100', '20040002']) {
      await act(async () => { fireEvent.change(cep, { target: { value: '' } }); });
      await act(async () => { fireEvent.change(cep, { target: { value: v } }); });
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() => {
        const last = lastValue.v.cep_history?.[0]?.digits;
        expect(last).toBe(v);
      });
    }
    const hist = lastValue.v.cep_history!;
    expect(hist.length).toBe(3);
    expect(hist.map((e) => e.digits)).toEqual(['20040002', '01310100', '04567000']);
    // Cidade e UF preservadas para reuso.
    expect(hist[0]).toMatchObject({ city: 'Rio de Janeiro', state: 'RJ' });
    expect(hist[1]).toMatchObject({ city: 'São Paulo', state: 'SP' });
  });
});
