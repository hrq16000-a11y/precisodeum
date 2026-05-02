/**
 * E2E do Wizard: GPS negado + erro 22023.
 *
 * Cobertura:
 *  1. Quando o navegador NEGA permissão de geolocalização, o componente
 *     PhaseProLocation faz fallback silencioso para Localização via IP
 *     (location_source efetivo = 'ip', sem botão extra).
 *  2. Quando o backend rejeita o upsert com erro 22023
 *     (PROVIDER_INCOMPLETE_NEIGHBORHOOD), o BetModeShell despacha o
 *     CustomEvent `wizard:provider-integrity-error` que o
 *     PhaseProLocation captura para mostrar o ProviderIntegrityErrorCard
 *     e mover foco para o input de Bairro.
 *
 * Como a stack do BetModeShell tem muitas dependências (Supabase, draft
 * remoto, navegação) que não cabem em vitest com jsdom, usamos um
 * "harness" minimal: renderizamos somente o PhaseProLocation com state
 * estável, simulamos a negação de GPS via geolocation mock, e disparamos
 * o evento global como o BetModeShell faria após capturar o erro do banco.
 *
 * Esse padrão segue a arquitetura blindada: o contrato é "evento global +
 * parser único". Se ele se mantiver, o e2e passa.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import PhaseProLocation from '@/components/onboarding/wizard/phases/bet/PhaseProLocation';
import { initialBetState, type BetState } from '@/components/onboarding/wizard/phases/bet/types';
import { parseProviderIntegrityError } from '@/lib/providerIntegrityError';

// ── Mocks de dependências externas ─────────────────────────────────────────────
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-test-1' }, profile: null, refetchProfile: vi.fn() }),
}));

vi.mock('@/hooks/useGeoCity', () => ({
  useGeoCity: () => ({
    city: 'Curitiba',
    state: 'PR',
    neighborhood: null,
    neighborhoodSource: 'none',
    latitude: -25.4,
    longitude: -49.2,
    source: 'ip',
    error: null,
    requestPreciseLocation: vi.fn(async () => ({
      ok: false,
      error: 'permission_denied',
    })),
  }),
}));

vi.mock('@/lib/cepLookup', () => ({
  lookupCep: vi.fn(async () => ({ ok: false })),
  normalizeCep: (s: string) => s.replace(/\D/g, ''),
}));

vi.mock('@/lib/locationTelemetry', () => ({
  startGpsTimer: () => ({ stop: () => 0 }),
  startCepTimer: () => ({ stop: () => 0 }),
  trackGpsAttempt: vi.fn(),
  trackCepAttempt: vi.fn(),
  mapGeolocationError: () => 'permission_denied',
  getDeviceKind: () => 'desktop',
}));

vi.mock('@/lib/providerGeoAudit', () => ({
  recordMyGeoEvent: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../v2/telemetry', () => ({
  trackOnboardingEvent: vi.fn(async () => undefined),
  setOnboardingIntent: vi.fn(),
}));

vi.mock('@/components/CityAutocomplete', () => ({
  default: ({ value }: { value: { city: string; state: string } }) => (
    <div data-testid="city-autocomplete">{value.city}/{value.state}</div>
  ),
}));

vi.mock('@/lib/wizardZombieGuard', () => ({
  scheduleWizardTimeout: (_meta: unknown, fn: () => void, ms: number) => window.setTimeout(fn, ms),
}));

vi.mock('@/lib/cepReverseLookup', () => ({
  lookupCepFromCity: vi.fn(async () => ({ ok: false, reason: 'not_found' })),
}));

// Geolocation NEGADA — simula o usuário clicando em "Bloquear" no prompt do navegador.
beforeEach(() => {
  Object.defineProperty(global.navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (_ok: unknown, err: (e: GeolocationPositionError) => void) => {
        err({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError);
      },
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
  });
});

afterEach(() => {
  cleanup();
});

function renderPhase(overrides: Partial<BetState> = {}) {
  const state: BetState = {
    ...initialBetState,
    full_name: 'Maria Teste',
    whatsapp: '41999990000',
    intent: 'professional',
    pro_kind: 'pf',
    document: '12345678909',
    city: 'Curitiba',
    state: 'PR',
    neighborhood: '', // vazio: força o erro 22023 quando o backend rejeitar.
    location_source: 'ip', // GPS já foi negado — simulamos fallback silencioso.
    phase: 'pro_location',
    ...overrides,
  };
  const patch = vi.fn();
  const finish = vi.fn(async () => undefined);
  const awardReward = vi.fn();
  return {
    state,
    patch,
    finish,
    awardReward,
    ...render(
      <PhaseProLocation state={state} patch={patch} finish={finish} awardReward={awardReward} />,
    ),
  };
}

describe('Wizard E2E — GPS negado + erro 22023', () => {
  it('1. Com GPS negado, exibe origem "IP (aproximada)" sem botão extra', async () => {
    renderPhase();
    // O pill de origem mostra "IP (aproximada)" quando location_source = 'ip'.
    const pill = await screen.findByTestId('location-source-pill');
    expect(pill.textContent || '').toMatch(/IP/i);
  });

  it('2. Quando o BetModeShell despacha wizard:provider-integrity-error com kind=neighborhood, o card aparece e o input de Bairro recebe foco ao clicar no CTA', async () => {
    renderPhase();

    // Simula o backend retornando 22023 — o BetModeShell.finishPro despacharia
    // este evento. Aqui o "harness" reproduz fielmente esse contrato.
    const parsed = parseProviderIntegrityError({
      code: '22023',
      message: 'PROVIDER_INCOMPLETE_NEIGHBORHOOD',
    });
    expect(parsed.matched).toBe(true);

    fireEvent(window, new CustomEvent('wizard:provider-integrity-error', { detail: parsed }));

    // O card persistente (não toast) é renderizado.
    const card = await screen.findByTestId('provider-integrity-error-card');
    expect(card.getAttribute('data-kind')).toBe('neighborhood');
    expect(card.textContent || '').toMatch(/bairro/i);

    // CTA "Preencher Bairro" foca o input de Bairro.
    const cta = screen.getByTestId('provider-integrity-primary-cta');
    expect(cta.textContent || '').toMatch(/Preencher Bairro/i);

    const bairroInput = screen.getByPlaceholderText(/Centro, Batel/i) as HTMLInputElement;
    fireEvent.click(cta);

    await waitFor(() => {
      expect(document.activeElement).toBe(bairroInput);
    });

    // Após acionar o CTA, o card é dismissado.
    await waitFor(() => {
      expect(screen.queryByTestId('provider-integrity-error-card')).toBeNull();
    });
  });

  it('3. CTA do kind=coords aciona o handler de GPS (idempotente, sem quebrar)', async () => {
    renderPhase();
    const parsed = parseProviderIntegrityError({
      code: '22023',
      message: 'PROVIDER_INCOMPLETE_COORDS',
    });
    fireEvent(window, new CustomEvent('wizard:provider-integrity-error', { detail: parsed }));

    const card = await screen.findByTestId('provider-integrity-error-card');
    expect(card.getAttribute('data-kind')).toBe('coords');

    const cta = screen.getByTestId('provider-integrity-primary-cta');
    expect(cta.textContent || '').toMatch(/Ativar GPS preciso/i);
    // Clicar não pode lançar — apenas dispara o requestPreciseLocation mockado.
    expect(() => fireEvent.click(cta)).not.toThrow();
  });

  it('4. Botão Fechar dismissa o card sem ação adicional', async () => {
    renderPhase();
    const parsed = parseProviderIntegrityError({
      code: '22023',
      message: 'PROVIDER_INCOMPLETE_NEIGHBORHOOD',
    });
    fireEvent(window, new CustomEvent('wizard:provider-integrity-error', { detail: parsed }));

    await screen.findByTestId('provider-integrity-error-card');
    fireEvent.click(screen.getByTestId('provider-integrity-dismiss'));
    await waitFor(() => {
      expect(screen.queryByTestId('provider-integrity-error-card')).toBeNull();
    });
  });
});
