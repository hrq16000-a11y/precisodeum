/**
 * Garante que `neighborhood_source` e o sinal de "precise" (gps_accuracy_m)
 * são persistidos corretamente no estado do wizard e mapeados para o payload
 * de providers, e que o ProfileLocationChecklist exibe a precisão.
 *
 * Cobertura:
 *  1) Auto-fill (IP) → seta neighborhood_source = 'bigdatacloud' quando preenche bairro.
 *  2) Auto-fill (IP) NÃO sobrescreve neighborhood_source = 'user' já existente.
 *  3) Edição manual de bairro → neighborhood_source = 'user'.
 *  4) Limpar bairro → neighborhood_source = null (libera trigger DB).
 *  5) Payload (BetModeShell): mapeia geo_source / geo_source_confidence / neighborhood_source.
 *  6) ProfileLocationChecklist: mostra "GPS preciso (±Xm)" quando provider tem geo_source='gps'
 *     com confidence ≤ 100, e "GPS aproximado" quando > 100.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PhaseProLocation from '@/components/onboarding/wizard/phases/bet/PhaseProLocation';
import ProfileLocationChecklist from '@/components/dashboard/ProfileLocationChecklist';
import { initialBetState, type BetState } from '@/components/onboarding/wizard/phases/bet/types';
import { normalizeProviderPayload } from '@/lib/providerPayload';

let geoFixture: any;
vi.mock('@/hooks/useGeoCity', () => ({ useGeoCity: () => geoFixture }));
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
      <PhaseProLocation state={state} patch={patch} finish={vi.fn()} awardReward={vi.fn()} />,
    ),
  };
}

beforeEach(() => cleanup());

describe('loc-persist · bairroSource e precise', () => {
  it('1) Auto-fill IP → patch carrega neighborhood_source = bigdatacloud', () => {
    geoFixture = {
      city: 'Curitiba', state: 'PR', neighborhood: 'Batel',
      neighborhoodSource: 'bigdatacloud',
      latitude: -25.4, longitude: -49.2,
      source: 'ip', precise: false,
      requestPreciseLocation: vi.fn(),
    };
    const patch = vi.fn();
    renderPhase({ ...initialBetState }, patch);

    const calls = patch.mock.calls.flat();
    const filled = calls.find((c) => c?.neighborhood === 'Batel');
    expect(filled).toBeTruthy();
    expect(filled.neighborhood_source).toBe('bigdatacloud');
  });

  it('2) Auto-fill NÃO sobrescreve neighborhood_source = user já existente', () => {
    geoFixture = {
      city: 'Curitiba', state: 'PR', neighborhood: 'Outro',
      neighborhoodSource: 'bigdatacloud',
      latitude: null, longitude: null,
      source: 'ip', precise: false,
      requestPreciseLocation: vi.fn(),
    };
    const patch = vi.fn();
    // Já temos cidade preenchida → guard `state.city` impede o auto-fill.
    renderPhase(
      { ...initialBetState, city: 'Curitiba', state: 'PR', neighborhood: 'Bigorrilho', neighborhood_source: 'user' },
      patch,
    );
    const overwrote = patch.mock.calls
      .flat()
      .some((c) => c?.neighborhood === 'Outro' || c?.neighborhood_source === 'bigdatacloud');
    expect(overwrote).toBe(false);
  });

  it('3) Digitar no input de bairro → patch envia neighborhood_source = user', () => {
    geoFixture = {
      city: '', state: '', neighborhood: null,
      neighborhoodSource: 'none',
      latitude: null, longitude: null, source: null, precise: false,
      requestPreciseLocation: vi.fn(),
    };
    const patch = vi.fn();
    renderPhase({ ...initialBetState, city: 'Curitiba', state: 'PR' }, patch);

    const input = screen.getByPlaceholderText(/bairro/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Centro Cívico' } });

    const last = patch.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({ neighborhood: 'Centro Cívico', neighborhood_source: 'user' });
  });

  it('4) Apagar o bairro → neighborhood_source volta para null', () => {
    geoFixture = {
      city: '', state: '', neighborhood: null, neighborhoodSource: 'none',
      latitude: null, longitude: null, source: null, precise: false,
      requestPreciseLocation: vi.fn(),
    };
    const patch = vi.fn();
    renderPhase(
      { ...initialBetState, city: 'Curitiba', state: 'PR', neighborhood: 'X', neighborhood_source: 'user' },
      patch,
    );
    const input = screen.getByPlaceholderText(/bairro/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    const last = patch.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({ neighborhood: '', neighborhood_source: null });
  });

  it('5) Payload mapeia geo_source / geo_source_confidence / neighborhood_source', () => {
    const payload = normalizeProviderPayload({
      user_id: 'u1',
      account_type: 'autonomous',
      business_name: 'João',
      legal_name: 'João',
      whatsapp: '11999999999',
      phone: '11999999999',
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      latitude: -25.4,
      longitude: -49.2,
      geo_source: 'gps',
      geo_source_confidence: 42,
      neighborhood_source: 'gps',
      description: '',
    });
    expect(payload.geo_source).toBe('gps');
    expect(payload.geo_source_confidence).toBe(42);
    expect(payload.neighborhood_source).toBe('gps');
    expect(payload.neighborhood).toBe('Batel');
  });

  it('6) Checklist exibe "GPS preciso" quando confidence ≤ 100', () => {
    render(
      <MemoryRouter>
        <ProfileLocationChecklist
          provider={{
            city: 'Curitiba', state: 'PR', neighborhood: 'Batel',
            neighborhood_source: 'user',
            latitude: -25.4, longitude: -49.2,
            geo_source: 'gps', geo_source_confidence: 42,
            status: 'pending',
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/GPS preciso/i)).toBeTruthy();
    expect(screen.getByText(/±42m/i)).toBeTruthy();
  });

  it('6b) Checklist exibe "GPS aproximado" quando confidence > 100', () => {
    render(
      <MemoryRouter>
        <ProfileLocationChecklist
          provider={{
            city: 'Curitiba', state: 'PR', neighborhood: 'Batel',
            neighborhood_source: 'user',
            latitude: -25.4, longitude: -49.2,
            geo_source: 'gps', geo_source_confidence: 850,
            status: 'pending',
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/GPS aproximado/i)).toBeTruthy();
    expect(screen.getByText(/±850m/i)).toBeTruthy();
  });
});
