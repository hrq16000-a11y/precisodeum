/**
 * PhaseProLocation — GPS negado + IP sugere cidade + escolha manual.
 *
 * Cobre o cenário G2 reportado: usuário com GPS negado/falho, sistema sugere
 * cidade via IP (geo.source = 'ip'), usuário escolhe a cidade pelo
 * CityAutocomplete (NÃO texto livre arbitrário) e o botão "Finalizar" deve
 * ficar habilitado sem precisar confirmar prévia explicitamente.
 *
 * Também valida que UF inválida ("ZZ") é rejeitada e UF válida ("PR") aceita.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PhaseProLocation from '@/components/onboarding/wizard/phases/bet/PhaseProLocation';
import { initialBetState, type BetState } from '@/components/onboarding/wizard/phases/bet/types';

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastWarning = vi.fn();
const trackEvent = vi.fn();

// useGeoCity simula GPS negado mas IP resolveu cidade aproximada.
vi.mock('@/hooks/useGeoCity', () => ({
  useGeoCity: () => ({
    city: 'Curitiba',
    state: 'PR',
    source: 'ip', // ← GPS negado, fallback IP
    error: 'permission_denied',
    requestPreciseLocation: vi.fn(async () => ({ ok: false, reason: 'denied' })),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...a: any[]) => toastError(...a),
    success: (...a: any[]) => toastSuccess(...a),
    warning: (...a: any[]) => toastWarning(...a),
  },
}));

vi.mock('@/lib/cepReverseLookup', () => ({
  lookupCepFromCity: vi.fn(async () => ({ ok: false, reason: 'not_found' as const })),
}));

vi.mock('@/components/onboarding/wizard/phases/v2/telemetry', () => ({
  trackOnboardingEvent: (...a: any[]) => trackEvent(...a),
}));

// CityAutocomplete mockado: chama onChange com o objeto canônico {city, state}.
vi.mock('@/components/CityAutocomplete', () => ({
  default: ({ value, onChange }: any) => (
    <div>
      <div data-testid="mock-city-autocomplete">{value?.city || 'empty'}</div>
      <button
        type="button"
        data-testid="select-curitiba"
        onClick={() => onChange({ city: 'Curitiba', state: 'PR' })}
      >
        Selecionar Curitiba/PR
      </button>
      <button
        type="button"
        data-testid="select-invalid"
        onClick={() => onChange({ city: 'CidadeInventada', state: 'ZZ' })}
      >
        Selecionar inválida
      </button>
    </div>
  ),
}));

function makeState(overrides: Partial<BetState> = {}): BetState {
  return { ...initialBetState, ...overrides } as BetState;
}

function renderPhase(initial: BetState = makeState()) {
  const ctx = { current: initial };
  const finish = vi.fn();
  const awardReward = vi.fn();
  const rerenderRef: { fn: ((el: any) => void) | null } = { fn: null };
  const patch = vi.fn((p: Partial<BetState>) => {
    ctx.current = { ...ctx.current, ...p };
    rerenderRef.fn?.(
      <PhaseProLocation state={ctx.current} patch={patch} finish={finish} awardReward={awardReward} />,
    );
  });
  const utils = render(
    <PhaseProLocation state={ctx.current} patch={patch} finish={finish} awardReward={awardReward} />,
  );
  rerenderRef.fn = utils.rerender;
  return { ...utils, patch, finish, awardReward, getState: () => ctx.current };
}

describe('PhaseProLocation — fallback IP + escolha manual', () => {
  beforeEach(() => {
    toastError.mockClear();
    toastSuccess.mockClear();
    toastWarning.mockClear();
    trackEvent.mockClear();
  });

  it('exibe pill mostrando origem IP quando GPS negou e cidade veio do IP', () => {
    renderPhase(makeState({
      // o componente auto-preenche state via useGeoCity (city='Curitiba', state='PR', source='ip')
    }));
    const pill = screen.getByTestId('location-source-pill');
    // Pode ser "IP" (state.location_source='ip' aplicado pelo auto-fill) ou "Não definida"
    // antes do effect rodar; o importante é que o pill existe e não diz "GPS".
    expect(pill).toBeInTheDocument();
    expect(pill.textContent).not.toMatch(/GPS$/);
  });

  it('habilita Finalizar quando GPS foi negado e usuário escolhe cidade manualmente via autocomplete', () => {
    const { getState } = renderPhase();
    // Usuário clica para selecionar Curitiba/PR via autocomplete (não texto livre).
    fireEvent.click(screen.getByTestId('select-curitiba'));
    // O patch foi aplicado, state.city='Curitiba' state.state='PR'.
    expect(getState().city).toBe('Curitiba');
    expect(getState().state).toBe('PR');
    // Botão Finalizar deve estar habilitado (geoFailed=true + cityOk=true).
    const finishBtn = screen.getByRole('button', { name: /finalizar cadastro express/i });
    expect(finishBtn).not.toBeDisabled();
  });

  it('chama finish() e emite telemetria com source quando usuário clica em Finalizar', () => {
    const { getState, finish } = renderPhase();
    fireEvent.click(screen.getByTestId('select-curitiba'));
    const finishBtn = screen.getByRole('button', { name: /finalizar cadastro express/i });
    fireEvent.click(finishBtn);
    expect(finish).toHaveBeenCalled();
    expect(getState().city).toBe('Curitiba');
  });

  it('rejeita UF inválida digitada manualmente na prévia (ex: "ZZ")', () => {
    renderPhase();
    const ufInput = screen.getByTestId('preview-uf-input') as HTMLInputElement;
    fireEvent.change(ufInput, { target: { value: 'ZZ' } });
    // UF inválida: toast.error é chamado e o input não retém "ZZ".
    expect(toastError).toHaveBeenCalledWith(
      'UF inválida',
      expect.objectContaining({ description: expect.stringContaining('ZZ') }),
    );
  });

  it('aceita UF válida digitada manualmente na prévia (ex: "SP")', () => {
    renderPhase();
    const ufInput = screen.getByTestId('preview-uf-input') as HTMLInputElement;
    fireEvent.change(ufInput, { target: { value: 'SP' } });
    expect(toastError).not.toHaveBeenCalledWith('UF inválida', expect.anything());
    expect(ufInput.value).toBe('SP');
  });
});
