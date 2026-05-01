/**
 * Persistência do histórico de CEPs no estado pai (BetState/OnboardingProfileData).
 *
 * Quando `value.cep_history` é fornecido, o componente é controlado: reads/writes
 * passam pelo `onChange`. Isso garante que o histórico sobreviva à navegação
 * entre steps do wizard (unmount/remount).
 *
 * Modo não-controlado (sem `cep_history`) mantém estado interno — para uso
 * isolado fora do wizard (ex.: testes legados, formulários standalone).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import { useState } from 'react';
import CompanyAddressForm, {
  type CompanyAddressValue,
  type CepHistoryEntry,
} from '@/components/company/CompanyAddressForm';

vi.mock('@/lib/cepLookup', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cepLookup')>('@/lib/cepLookup');
  return { ...actual, lookupCep: vi.fn() };
});
import { lookupCep } from '@/lib/cepLookup';
const lookupCepMock = lookupCep as unknown as ReturnType<typeof vi.fn>;

function ControlledHarness({
  initial,
  onChange,
}: {
  initial: CompanyAddressValue;
  onChange?: (v: CompanyAddressValue) => void;
}) {
  const [value, setValue] = useState<CompanyAddressValue>(initial);
  return (
    <CompanyAddressForm
      value={value}
      onChange={(p) =>
        setValue((v) => {
          const next = { ...v, ...p };
          onChange?.(next);
          return next;
        })
      }
    />
  );
}

describe('CompanyAddressForm — persistência do histórico de CEPs', () => {
  beforeEach(() => {
    lookupCepMock.mockReset();
    cleanup();
  });

  it('quando controlado, escreve cep_history via onChange (não usa estado interno)', async () => {
    lookupCepMock.mockResolvedValueOnce({
      ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP',
      address: 'Avenida Paulista', source: 'brasilapi',
    });
    const lastValue = { v: null as CompanyAddressValue | null };
    render(
      <ControlledHarness
        initial={{ cep_history: [] }}
        onChange={(v) => { lastValue.v = v; }}
      />,
    );
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => { fireEvent.change(cep, { target: { value: '01310100' } }); });
    await waitFor(() => {
      expect(lastValue.v?.cep_history?.length ?? 0).toBeGreaterThan(0);
    });
    const hist = lastValue.v!.cep_history!;
    expect(hist[0].digits).toBe('01310100');
    expect(hist[0].address).toBe('Avenida Paulista');
  });

  it('renderiza histórico vindo do estado pai mesmo sem fazer lookup nesta montagem', async () => {
    const seeded: CepHistoryEntry[] = [
      { cep: '01310-100', digits: '01310100', address: 'Avenida Paulista', city: 'São Paulo', state: 'SP' },
      { cep: '04567-000', digits: '04567000', address: 'Avenida Brigadeiro', city: 'São Paulo', state: 'SP' },
    ];
    render(<ControlledHarness initial={{ cep_history: seeded }} />);
    expect(screen.getByTestId('cep-history')).toBeTruthy();
    expect(screen.getByTestId('cep-history-item-01310100')).toBeTruthy();
    expect(screen.getByTestId('cep-history-item-04567000')).toBeTruthy();
    // Nenhum lookup foi disparado (validação chave da persistência).
    expect(lookupCepMock).not.toHaveBeenCalled();
  });

  it('histórico sobrevive a unmount/remount quando persistido no estado pai', async () => {
    // Mock para o 1º lookup (durante typing) e um 2º para o remount
    // (que ainda tem postal_code preenchido e dispara lookup automático).
    lookupCepMock
      .mockResolvedValueOnce({
        ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP',
        address: 'Avenida Paulista', source: 'brasilapi',
      })
      .mockResolvedValue({
        ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP',
        address: 'Avenida Paulista', source: 'brasilapi',
      });
    // Estado pai persistido fora do componente — simula BetState do wizard.
    const lastValue = { v: { cep_history: [] } as CompanyAddressValue };
    const { unmount } = render(
      <ControlledHarness
        initial={lastValue.v}
        onChange={(v) => { lastValue.v = v; }}
      />,
    );
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    await act(async () => { fireEvent.change(cep, { target: { value: '01310100' } }); });
    await waitFor(() => {
      expect((lastValue.v.cep_history ?? []).length).toBeGreaterThan(0);
    });
    unmount();

    // Remonta com o estado pai persistido — histórico já está visível ANTES
    // de qualquer novo lookup (chave da persistência).
    render(<ControlledHarness initial={lastValue.v} />);
    expect(screen.getByTestId('cep-history-item-01310100')).toBeTruthy();
  });

  it('dedupe e LRU operam sobre o histórico controlado (máx 3)', async () => {
    lookupCepMock
      .mockResolvedValueOnce({ ok: true, cep: '01001-000', city: 'São Paulo', state: 'SP', address: 'Praça da Sé', source: 'brasilapi' })
      .mockResolvedValueOnce({ ok: true, cep: '04567-000', city: 'São Paulo', state: 'SP', address: 'Avenida Brigadeiro', source: 'brasilapi' })
      .mockResolvedValueOnce({ ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP', address: 'Avenida Paulista', source: 'brasilapi' })
      .mockResolvedValueOnce({ ok: true, cep: '20040-002', city: 'Rio de Janeiro', state: 'RJ', address: 'Rua da Carioca', source: 'brasilapi' });
    const lastValue = { v: null as CompanyAddressValue | null };
    render(
      <ControlledHarness
        initial={{ cep_history: [] }}
        onChange={(v) => { lastValue.v = v; }}
      />,
    );
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    for (const v of ['01001000', '04567000', '01310100', '20040002']) {
      await act(async () => { fireEvent.change(cep, { target: { value: '' } }); });
      await act(async () => { fireEvent.change(cep, { target: { value: v } }); });
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() => {
        const last = lastValue.v?.cep_history?.[0]?.digits;
        expect(last).toBe(v);
      });
    }
    const hist = lastValue.v!.cep_history!;
    expect(hist.length).toBe(3);
    expect(hist.map((e) => e.digits)).toEqual(['20040002', '01310100', '04567000']);
  });
});
