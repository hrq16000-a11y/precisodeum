/**
 * Reuso do snapshot IP/GPS no wizard sem sobrescrever digitação manual.
 *
 * Valida o contrato do `useEffect` de auto-sugestão em PhaseProLocation
 * (linhas 50–70 do componente):
 *
 *   1. Snapshot IP chega ANTES do usuário digitar → cidade/UF/bairro do
 *      snapshot são pré-preenchidos.
 *   2. Usuário digita cidade manualmente → snapshot NÃO sobrescreve.
 *   3. Usuário volta para a fase (re-monta) → seu valor digitado persiste,
 *      o snapshot continua quieto (autoFilledRef + guard `state.city`).
 *   4. Bairro digitado manualmente NÃO é trocado pelo do snapshot mesmo
 *      quando vier um snapshot novo (GPS preciso após manual).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import PhaseProLocation from '@/components/onboarding/wizard/phases/bet/PhaseProLocation';
import { initialBetState, type BetState } from '@/components/onboarding/wizard/phases/bet/types';

// Snapshot IP/GPS controlado por mock — mudamos `geoFixture` entre testes.
let geoFixture: any;
vi.mock('@/hooks/useGeoCity', () => ({
  useGeoCity: () => geoFixture,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/providerGeoAudit', () => ({ recordMyGeoEvent: vi.fn() }));
vi.mock('@/components/onboarding/wizard/phases/v2/telemetry', () => ({
  trackOnboardingEvent: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

function renderPhase(state: BetState, patch = vi.fn()) {
  return {
    patch,
    ...render(
      <PhaseProLocation
        state={state}
        patch={patch}
        finish={vi.fn()}
        awardReward={vi.fn()}
      />,
    ),
  };
}

beforeEach(() => {
  cleanup();
});

describe('snapshot IP/GPS · reuso sem sobrescrever digitação manual', () => {
  it('1) Snapshot IP pré-preenche quando o estado está vazio', () => {
    geoFixture = {
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Centro',
      neighborhoodSource: 'bigdatacloud',
      latitude: -25.42,
      longitude: -49.27,
      source: 'ip',
      precise: false,
      manualOverride: false,
      requestPreciseLocation: vi.fn(),
    };
    const empty: BetState = { ...initialBetState, city: '', state: '', neighborhood: '' };
    const { patch } = renderPhase(empty);

    // Auto-fill chamou patch com city/state/neighborhood do snapshot
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'Curitiba', state: 'PR', neighborhood: 'Centro' }),
    );
  });

  it('2) Snapshot NÃO sobrescreve cidade já digitada manualmente', () => {
    geoFixture = {
      city: 'São Paulo',
      state: 'SP',
      neighborhood: 'Pinheiros',
      neighborhoodSource: 'bigdatacloud',
      latitude: -23.5,
      longitude: -46.6,
      source: 'ip',
      precise: false,
      manualOverride: false,
      requestPreciseLocation: vi.fn(),
    };
    const typed: BetState = {
      ...initialBetState,
      city: 'Curitiba', // ← usuário digitou
      state: 'PR',
      neighborhood: '',
    };
    const { patch } = renderPhase(typed);

    // Effect tem guard `if (state.city && state.city.trim().length > 0) return;`
    // → patch não deve ser chamado pelo auto-fill com a cidade do snapshot.
    const calls = patch.mock.calls.flat();
    const overwroteCity = calls.some(
      (arg: any) => arg && typeof arg === 'object' && arg.city === 'São Paulo',
    );
    expect(overwroteCity).toBe(false);
  });

  it('3) Re-render (voltar/avançar entre fases) preserva valor digitado', () => {
    geoFixture = {
      city: 'Recife',
      state: 'PE',
      neighborhood: 'Boa Viagem',
      neighborhoodSource: 'bigdatacloud',
      latitude: -8,
      longitude: -34.9,
      source: 'ip',
      precise: false,
      manualOverride: false,
      requestPreciseLocation: vi.fn(),
    };
    const typed: BetState = {
      ...initialBetState,
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel', // digitado pelo usuário
    };
    const patch = vi.fn();

    // Primeira montagem
    const { unmount } = render(
      <PhaseProLocation state={typed} patch={patch} finish={vi.fn()} awardReward={vi.fn()} />,
    );
    unmount();

    // Re-monta (simula volta de fase) — patch não deve receber cidade do snapshot
    render(
      <PhaseProLocation state={typed} patch={patch} finish={vi.fn()} awardReward={vi.fn()} />,
    );

    const overwriteAttempts = patch.mock.calls
      .map((c) => c[0])
      .filter((arg: any) => arg && (arg.city === 'Recife' || arg.neighborhood === 'Boa Viagem'));
    expect(overwriteAttempts).toHaveLength(0);
  });

  it('4) Bairro manual permanece quando GPS preciso traz outro bairro', () => {
    geoFixture = {
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Centro Cívico', // diferente do digitado
      neighborhoodSource: 'bigdatacloud',
      latitude: -25.42,
      longitude: -49.27,
      source: 'gps',
      precise: true,
      manualOverride: false,
      requestPreciseLocation: vi.fn(),
    };
    const typed: BetState = {
      ...initialBetState,
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel', // ← digitado
    };
    const { patch } = renderPhase(typed);

    const calls = patch.mock.calls.flat();
    const overwroteNeighborhood = calls.some(
      (arg: any) => arg && typeof arg === 'object' && arg.neighborhood === 'Centro Cívico',
    );
    expect(overwroteNeighborhood).toBe(false);
  });

  it('5) Bairro vazio permite auto-fill via snapshot (não-destrutivo)', () => {
    geoFixture = {
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      neighborhoodSource: 'bigdatacloud',
      latitude: -25.42,
      longitude: -49.27,
      source: 'ip',
      precise: false,
      manualOverride: false,
      requestPreciseLocation: vi.fn(),
    };
    const typed: BetState = {
      ...initialBetState,
      city: '', // vazio → auto-fill libera
      state: '',
      neighborhood: '',
    };
    const { patch } = renderPhase(typed);

    const calls = patch.mock.calls.flat();
    const filled = calls.some(
      (arg: any) => arg && arg.city === 'Curitiba' && arg.neighborhood === 'Batel',
    );
    expect(filled).toBe(true);
  });
});
