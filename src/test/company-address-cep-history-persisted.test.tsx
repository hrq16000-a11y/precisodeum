/**
 * Persistência do cep_history no estado pai (BetState/OnboardingProfileData).
 *
 * Quando `value.cep_history` é fornecido, o componente é controlado: writes
 * passam pelo `onChange`. Isso garante que o histórico sobreviva à navegação
 * entre steps do wizard (unmount/remount).
 *
 * A UI de "CEPs recentes" foi removida — esses testes garantem apenas a
 * persistência do array em estado pai, sem depender de elementos de UI.
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

describe('CompanyAddressForm — persistência do cep_history (sem UI)', () => {
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
    expect(hist[0].city).toBe('São Paulo');
    expect(hist[0].state).toBe('SP');
  });

  it('histórico hidratado do estado pai NÃO dispara lookup nesta montagem', async () => {
    const seeded: CepHistoryEntry[] = [
      { cep: '01310-100', digits: '01310100', address: 'Avenida Paulista', city: 'São Paulo', state: 'SP' },
      { cep: '04567-000', digits: '04567000', address: 'Avenida Brigadeiro', city: 'São Paulo', state: 'SP' },
    ];
    render(<ControlledHarness initial={{ cep_history: seeded }} />);
    // Sem postal_code, nenhum lookup automático ocorre — histórico só sobrevive no estado.
    expect(lookupCepMock).not.toHaveBeenCalled();
    // E nenhum elemento de UI de histórico é renderizado (regressão).
    expect(screen.queryByTestId('cep-history')).toBeNull();
  });

  it('histórico sobrevive a unmount/remount quando persistido no estado pai', async () => {
    lookupCepMock
      .mockResolvedValueOnce({
        ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP',
        address: 'Avenida Paulista', source: 'brasilapi',
      })
      .mockResolvedValue({
        ok: true, cep: '01310-100', city: 'São Paulo', state: 'SP',
        address: 'Avenida Paulista', source: 'brasilapi',
      });
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

    // Remonta com o estado pai persistido — o array continua lá.
    render(<ControlledHarness initial={lastValue.v} />);
    expect(lastValue.v.cep_history?.[0]?.digits).toBe('01310100');
    expect(lastValue.v.cep_history?.[0]?.city).toBe('São Paulo');
  });
});
