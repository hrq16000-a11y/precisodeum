/**
 * Testes do PhaseProLocation — comportamento de GPS impreciso e permissão negada.
 *
 * Cobre:
 *   1. Quando o GPS retorna ok com accuracyMeters > 500, exibimos um aviso
 *      visível ("GPS impreciso") instruindo o usuário a confirmar o bairro.
 *   2. Quando a permissão é negada (ok=false), exibimos toast.error e
 *      NÃO marcamos pontos nem preenchemos cidade automaticamente.
 *   3. Quando o GPS retorna preciso (<500m), nenhum aviso impreciso aparece.
 *
 * Os testes mocam `useGeoCity` e `lookupCepFromCity` para isolar o componente.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhaseProLocation from '@/components/onboarding/wizard/phases/bet/PhaseProLocation';
import { initialBetState, type BetState } from '@/components/onboarding/wizard/phases/bet/types';

const requestPreciseLocationMock = vi.fn();
const toastWarning = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('@/hooks/useGeoCity', () => ({
  useGeoCity: () => ({
    city: null,
    state: null,
    source: 'none',
    requestPreciseLocation: requestPreciseLocationMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    warning: (...a: any[]) => toastWarning(...a),
    error: (...a: any[]) => toastError(...a),
    success: (...a: any[]) => toastSuccess(...a),
  },
}));

vi.mock('@/lib/cepReverseLookup', () => ({
  lookupCepFromCity: vi.fn(async () => ({ ok: false, reason: 'not_found' as const })),
}));

vi.mock('@/components/CityAutocomplete', () => ({
  default: ({ value }: any) => (
    <div data-testid="mock-city-autocomplete">{value?.city || 'no-city'}</div>
  ),
}));

function makeState(overrides: Partial<BetState> = {}): BetState {
  return { ...initialBetState, ...overrides } as BetState;
}

function renderPhase(state: BetState = makeState()) {
  const patch = vi.fn();
  const finish = vi.fn();
  const addPoints = vi.fn();
  const utils = render(
    <PhaseProLocation
      state={state}
      patch={patch}
      finish={finish}
      addPoints={addPoints}
    />,
  );
  return { ...utils, patch, finish, addPoints };
}

describe('PhaseProLocation — GPS imprecision & denial', () => {
  beforeEach(() => {
    requestPreciseLocationMock.mockReset();
    toastWarning.mockClear();
    toastError.mockClear();
    toastSuccess.mockClear();
  });

  it('shows imprecise GPS warning when accuracy > 500m', async () => {
    requestPreciseLocationMock.mockResolvedValueOnce({
      ok: true,
      city: 'Curitiba',
      state: 'PR',
      accuracyMeters: 1200,
    });
    renderPhase();
    fireEvent.click(screen.getByRole('button', { name: /Usar minha localização/i }));

    await waitFor(() => {
      expect(toastWarning).toHaveBeenCalledWith(
        'GPS impreciso',
        expect.objectContaining({ description: expect.stringContaining('1200') }),
      );
    });
    // Banner visual de aviso impreciso é renderizado.
    expect(await screen.findByText(/GPS impreciso/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirme o bairro/i)).toBeInTheDocument();
  });

  it('does NOT show imprecise warning when accuracy is good (<500m)', async () => {
    requestPreciseLocationMock.mockResolvedValueOnce({
      ok: true,
      city: 'Curitiba',
      state: 'PR',
      accuracyMeters: 80,
    });
    const { container } = renderPhase();
    fireEvent.click(screen.getByRole('button', { name: /Usar minha localização/i }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    // Nenhum elemento contém "GPS impreciso" como heading do banner.
    expect(toastWarning).not.toHaveBeenCalled();
    // O texto "GPS impreciso (margem" só aparece no banner de aviso — nunca no path feliz.
    expect(container.textContent).not.toMatch(/GPS impreciso \(margem/i);
  });

  it('shows error toast when permission is denied (ok=false)', async () => {
    requestPreciseLocationMock.mockResolvedValueOnce({
      ok: false,
      city: null,
      state: null,
      accuracyMeters: null,
    });
    const { patch, addPoints } = renderPhase();
    fireEvent.click(screen.getByRole('button', { name: /Usar minha localização/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Não consegui acessar o GPS',
        expect.any(Object),
      );
    });
    // Não pode patchar cidade nem dar pontos quando o GPS falha.
    expect(patch).not.toHaveBeenCalledWith(expect.objectContaining({ city: expect.any(String) }));
    expect(addPoints).not.toHaveBeenCalled();
  });
});
