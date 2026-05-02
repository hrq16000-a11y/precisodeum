/**
 * E2E paramétrico do Wizard de localização (Etapa 6/17).
 *
 * Cobre TODOS os caminhos de `location_source` que o front pode produzir e
 * valida o contrato fim-a-fim com o trigger `guard_provider_activation`
 * (SQLSTATE 22023):
 *
 *   1) gps     → DbGeoSource = 'gps'
 *   2) ip      → DbGeoSource = 'city_center'   (fallback silencioso)
 *   3) cep     → DbGeoSource = 'address_geocode'
 *   4) manual  → DbGeoSource = 'address_geocode'
 *
 * Cada caminho é submetido a 3 variantes de erro 22023 disparadas pelo
 * BetModeShell via `wizard:provider-integrity-error`:
 *
 *   a) PROVIDER_INCOMPLETE_NEIGHBORHOOD → foca Bairro
 *   b) PROVIDER_INCOMPLETE_COORDS       → CTA "Ativar GPS preciso"
 *   c) PROVIDER_INCOMPLETE_CITY         → CTA "Selecionar Cidade"
 *
 * O harness renderiza apenas o `PhaseProLocation` (jsdom não roda o stack
 * completo do Shell), simula a negação ou aceitação do GPS via mock do
 * `navigator.geolocation`, e dispara o evento global como o Shell faria
 * após capturar o erro do banco. Isso valida o contrato blindado:
 *  - parser único `parseProviderIntegrityError`
 *  - mapeamento determinístico em `mapLocationSourceToGeoSource`
 *  - card persistente `ProviderIntegrityErrorCard` com `data-kind`
 *  - foco programático via `wizard:focus-*`
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import PhaseProLocation from '@/components/onboarding/wizard/phases/bet/PhaseProLocation';
import {
  initialBetState,
  type BetState,
} from '@/components/onboarding/wizard/phases/bet/types';
import {
  parseProviderIntegrityError,
  type ProviderIntegrityKind,
} from '@/lib/providerIntegrityError';
import {
  mapLocationSourceToGeoSource,
  type FrontLocationSource,
  type DbGeoSource,
} from '@/lib/providerPayload';

// ── Mocks compartilhados ─────────────────────────────────────────────────────
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-paths-1' },
    profile: null,
    refetchProfile: vi.fn(),
  }),
}));

const requestPreciseLocationMock = vi.fn(async () => ({
  ok: false as const,
  error: 'permission_denied' as const,
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
    requestPreciseLocation: requestPreciseLocationMock,
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
    <div data-testid="city-autocomplete">
      {value.city}/{value.state}
    </div>
  ),
}));

vi.mock('@/lib/wizardZombieGuard', () => ({
  scheduleWizardTimeout: (_meta: unknown, fn: () => void, ms: number) =>
    window.setTimeout(fn, ms),
}));

vi.mock('@/lib/cepReverseLookup', () => ({
  lookupCepFromCity: vi.fn(async () => ({ ok: false, reason: 'not_found' })),
}));

// ── GPS mock (negado por padrão; sobreposto no caminho gps) ──────────────────
function mockGeolocationDenied() {
  Object.defineProperty(global.navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (
        _ok: unknown,
        err: (e: GeolocationPositionError) => void,
      ) => err({ code: 1, message: 'User denied' } as GeolocationPositionError),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
  });
}

beforeEach(() => {
  mockGeolocationDenied();
  requestPreciseLocationMock.mockClear();
});

afterEach(() => {
  cleanup();
});

function renderWith(overrides: Partial<BetState>) {
  const state: BetState = {
    ...initialBetState,
    full_name: 'Tester Path',
    whatsapp: '41999990000',
    intent: 'professional',
    pro_kind: 'pf',
    document: '12345678909',
    city: 'Curitiba',
    state: 'PR',
    neighborhood: '',
    location_source: 'ip',
    phase: 'pro_location',
    ...overrides,
  };
  return render(
    <PhaseProLocation
      state={state}
      patch={vi.fn()}
      finish={vi.fn(async () => undefined)}
      awardReward={vi.fn()}
    />,
  );
}

// ── 1) Mapeamento determinístico (contrato com a constraint do banco) ────────
describe('mapLocationSourceToGeoSource — todos os caminhos', () => {
  const cases: Array<[FrontLocationSource, DbGeoSource]> = [
    ['gps', 'gps'],
    ['ip', 'city_center'],
    ['cep', 'address_geocode'],
    ['manual', 'address_geocode'],
    [null, 'unknown'],
    [undefined, 'unknown'],
  ];

  it.each(cases)('%s → %s', (src, expected) => {
    expect(mapLocationSourceToGeoSource(src)).toBe(expected);
  });

  it('nunca produz valor fora do CHECK constraint do banco', () => {
    const allowed = new Set<DbGeoSource>([
      'gps',
      'city_center',
      'address_geocode',
      'unknown',
      'gps_plus_city_center',
      'gps_plus_address_geocode',
    ]);
    const fronts: FrontLocationSource[] = ['gps', 'ip', 'cep', 'manual', null, undefined];
    for (const f of fronts) {
      expect(allowed.has(mapLocationSourceToGeoSource(f))).toBe(true);
    }
  });
});

// ── 2) UI por caminho: pill de origem reflete location_source ────────────────
describe('PhaseProLocation — pill de origem por caminho', () => {
  const labelByPath: Record<Exclude<FrontLocationSource, null | undefined>, RegExp> = {
    gps: /GPS/i,
    ip: /IP/i,
    cep: /CEP|endereço/i,
    manual: /Manual|editado/i,
  };

  for (const path of ['gps', 'ip', 'cep', 'manual'] as const) {
    it(`location_source="${path}" exibe pill correspondente`, async () => {
      renderWith({ location_source: path });
      const pill = await screen.findByTestId('location-source-pill');
      expect(pill.textContent || '').toMatch(labelByPath[path]);
    });
  }
});

// ── 3) Trigger 22023 × variantes (parser + card persistente) ─────────────────
describe('Trigger 22023 — variantes de PROVIDER_INCOMPLETE_*', () => {
  const variants: Array<{
    msg: string;
    kind: ProviderIntegrityKind;
    cta: RegExp;
    focusEvent: string;
  }> = [
    {
      msg: 'PROVIDER_INCOMPLETE_NEIGHBORHOOD',
      kind: 'neighborhood',
      cta: /Preencher Bairro/i,
      focusEvent: 'wizard:focus-neighborhood',
    },
    {
      msg: 'PROVIDER_INCOMPLETE_COORDS',
      kind: 'coords',
      cta: /Ativar GPS preciso/i,
      focusEvent: 'wizard:focus-gps',
    },
    {
      msg: 'PROVIDER_INCOMPLETE_CITY',
      kind: 'city',
      cta: /Selecionar Cidade/i,
      focusEvent: 'wizard:focus-city',
    },
  ];

  for (const v of variants) {
    it(`${v.msg} → card data-kind="${v.kind}" + CTA correto`, async () => {
      renderWith({ location_source: 'ip' });

      const parsed = parseProviderIntegrityError({ code: '22023', message: v.msg });
      expect(parsed.matched).toBe(true);
      if (!parsed.matched) return;
      expect(parsed.kind).toBe(v.kind);
      expect(parsed.focusEvent).toBe(v.focusEvent);

      fireEvent(
        window,
        new CustomEvent('wizard:provider-integrity-error', { detail: parsed }),
      );

      const card = await screen.findByTestId('provider-integrity-error-card');
      expect(card.getAttribute('data-kind')).toBe(v.kind);

      const cta = screen.getByTestId('provider-integrity-primary-cta');
      expect(cta.textContent || '').toMatch(v.cta);
    });
  }

  it('todas as 4 origens (gps, ip, cep, manual) intercepta 22023 e mostra card', async () => {
    for (const path of ['gps', 'ip', 'cep', 'manual'] as const) {
      const { unmount } = renderWith({ location_source: path });
      const parsed = parseProviderIntegrityError({
        code: '22023',
        message: 'PROVIDER_INCOMPLETE_NEIGHBORHOOD',
      });
      fireEvent(
        window,
        new CustomEvent('wizard:provider-integrity-error', { detail: parsed }),
      );
      const card = await screen.findByTestId('provider-integrity-error-card');
      expect(card.getAttribute('data-kind')).toBe('neighborhood');
      unmount();
    }
  });

  it('CTA neighborhood foca o input de Bairro e dismissa o card', async () => {
    renderWith({ location_source: 'ip' });
    const parsed = parseProviderIntegrityError({
      code: '22023',
      message: 'PROVIDER_INCOMPLETE_NEIGHBORHOOD',
    });
    fireEvent(
      window,
      new CustomEvent('wizard:provider-integrity-error', { detail: parsed }),
    );

    const cta = await screen.findByTestId('provider-integrity-primary-cta');
    const input = screen.getByPlaceholderText(/Centro, Batel/i) as HTMLInputElement;
    fireEvent.click(cta);

    await waitFor(() => expect(document.activeElement).toBe(input));
    await waitFor(() =>
      expect(screen.queryByTestId('provider-integrity-error-card')).toBeNull(),
    );
  });

  it('CTA coords chama requestPreciseLocation e dismissa o card', async () => {
    renderWith({ location_source: 'ip' });
    const parsed = parseProviderIntegrityError({
      code: '22023',
      message: 'PROVIDER_INCOMPLETE_COORDS',
    });
    fireEvent(
      window,
      new CustomEvent('wizard:provider-integrity-error', { detail: parsed }),
    );

    const card = await screen.findByTestId('provider-integrity-error-card');
    expect(card.getAttribute('data-kind')).toBe('coords');

    const cta = screen.getByTestId('provider-integrity-primary-cta');
    expect(cta.textContent || '').toMatch(/Ativar GPS preciso/i);
    expect(requestPreciseLocationMock).not.toHaveBeenCalled();

    fireEvent.click(cta);

    await waitFor(() => expect(requestPreciseLocationMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByTestId('provider-integrity-error-card')).toBeNull(),
    );
  });

  it('CTA city faz scrollIntoView na pill de origem e dismissa o card', async () => {
    renderWith({ location_source: 'ip' });
    const parsed = parseProviderIntegrityError({
      code: '22023',
      message: 'PROVIDER_INCOMPLETE_CITY',
    });
    fireEvent(
      window,
      new CustomEvent('wizard:provider-integrity-error', { detail: parsed }),
    );

    const card = await screen.findByTestId('provider-integrity-error-card');
    expect(card.getAttribute('data-kind')).toBe('city');

    const cta = screen.getByTestId('provider-integrity-primary-cta');
    expect(cta.textContent || '').toMatch(/Selecionar Cidade/i);

    // Espia scrollIntoView da pill de origem (alvo do handler de kind=city).
    const pill = screen.getByTestId('location-source-pill');
    const scrollSpy = vi.fn();
    pill.scrollIntoView = scrollSpy as unknown as Element['scrollIntoView'];

    fireEvent.click(cta);

    await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
    const callArg = scrollSpy.mock.calls[0]?.[0];
    expect(callArg).toMatchObject({ block: 'center' });

    await waitFor(() =>
      expect(screen.queryByTestId('provider-integrity-error-card')).toBeNull(),
    );
  });


  it('Botão Fechar dismissa em qualquer kind', async () => {
    for (const msg of [
      'PROVIDER_INCOMPLETE_NEIGHBORHOOD',
      'PROVIDER_INCOMPLETE_COORDS',
      'PROVIDER_INCOMPLETE_CITY',
    ]) {
      const { unmount } = renderWith({ location_source: 'ip' });
      const parsed = parseProviderIntegrityError({ code: '22023', message: msg });
      fireEvent(
        window,
        new CustomEvent('wizard:provider-integrity-error', { detail: parsed }),
      );
      await screen.findByTestId('provider-integrity-error-card');
      fireEvent.click(screen.getByTestId('provider-integrity-dismiss'));
      await waitFor(() =>
        expect(screen.queryByTestId('provider-integrity-error-card')).toBeNull(),
      );
      unmount();
    }
  });

  it('erro não-22023 (ex.: 23505 duplicate) NÃO renderiza o card', async () => {
    renderWith({ location_source: 'ip' });
    const parsed = parseProviderIntegrityError({
      code: '23505',
      message: 'duplicate key value',
    });
    expect(parsed.matched).toBe(false);
    // Mesmo se um shell rebelde despachasse o evento sem detail válido,
    // o componente deve ignorar.
    fireEvent(
      window,
      new CustomEvent('wizard:provider-integrity-error', { detail: parsed }),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('provider-integrity-error-card')).toBeNull();
  });
});

// ── 4) Banner explicativo de fallback IP ─────────────────────────────────────
describe('Banner de fallback IP — explica o que aconteceu e o que revisar', () => {
  it('aparece quando location_source="ip" e descreve Cidade-base + Bairro', async () => {
    renderWith({ location_source: 'ip' });
    const notice = await screen.findByTestId('ip-fallback-notice');
    const text = notice.textContent || '';
    expect(text).toMatch(/Localização aproximada pelo seu IP/i);
    expect(text).toMatch(/Cidade-base/i);
    expect(text).toMatch(/Bairro/i);
    expect(text).toMatch(/GPS|navegador.*bloqueado/i);
  });

  it('NÃO aparece quando location_source="gps"', () => {
    renderWith({ location_source: 'gps' });
    expect(screen.queryByTestId('ip-fallback-notice')).toBeNull();
  });

  it('NÃO aparece quando location_source="cep"', () => {
    renderWith({ location_source: 'cep' });
    expect(screen.queryByTestId('ip-fallback-notice')).toBeNull();
  });

  it('NÃO aparece quando location_source="manual"', () => {
    renderWith({ location_source: 'manual' });
    expect(screen.queryByTestId('ip-fallback-notice')).toBeNull();
  });

  it('tem role="status" e aria-live="polite" para leitores de tela', async () => {
    renderWith({ location_source: 'ip' });
    const notice = await screen.findByTestId('ip-fallback-notice');
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.getAttribute('aria-live')).toBe('polite');
  });
});

// ── 5) Mensagens do ProviderIntegrityErrorCard por kind ──────────────────────
// Garante que o TÍTULO e a DESCRIÇÃO renderizados no card mudam corretamente
// para neighborhood/coords/city — e que o texto exibido condiz com o campo
// que o usuário precisa preencher (não há mensagens genéricas vazando).
describe('ProviderIntegrityErrorCard — mensagens por kind condizem com o campo', () => {
  type Expectation = {
    msg: string;
    kind: ProviderIntegrityKind;
    titleMatch: RegExp;
    /** Termos que DEVEM aparecer na descrição (todos). */
    descMustInclude: RegExp[];
    /** Termos que NÃO podem aparecer (cross-kind contamination). */
    descMustNotInclude: RegExp[];
    ctaMatch: RegExp;
  };

  const expectations: Expectation[] = [
    {
      msg: 'PROVIDER_INCOMPLETE_NEIGHBORHOOD',
      kind: 'neighborhood',
      titleMatch: /Bairro/i,
      descMustInclude: [/bairro/i, /Centro|Batel|Água Verde/i],
      descMustNotInclude: [/cidade-base/i, /GPS/i, /coordenadas/i],
      ctaMatch: /Preencher Bairro/i,
    },
    {
      msg: 'PROVIDER_INCOMPLETE_COORDS',
      kind: 'coords',
      titleMatch: /localiza/i,
      descMustInclude: [/GPS/i, /coordenadas|CEP/i],
      descMustNotInclude: [/^bairro$/i, /selecione.*cidade/i],
      ctaMatch: /Ativar GPS preciso/i,
    },
    {
      msg: 'PROVIDER_INCOMPLETE_CITY',
      kind: 'city',
      titleMatch: /Cidade-base/i,
      descMustInclude: [/cidade/i, /Curitiba\/PR|atende.*base/i],
      descMustNotInclude: [/digite o bairro/i, /GPS preciso/i],
      ctaMatch: /Selecionar Cidade/i,
    },
  ];

  for (const exp of expectations) {
    it(`kind="${exp.kind}" exibe título, descrição e CTA específicos do campo`, async () => {
      renderWith({ location_source: 'ip' });
      const parsed = parseProviderIntegrityError({ code: '22023', message: exp.msg });
      expect(parsed.matched).toBe(true);
      if (!parsed.matched) return;

      fireEvent(
        window,
        new CustomEvent('wizard:provider-integrity-error', { detail: parsed }),
      );

      const card = await screen.findByTestId('provider-integrity-error-card');
      expect(card.getAttribute('data-kind')).toBe(exp.kind);

      // Título (primeiro <p> com font-bold dentro do card)
      const title = card.querySelector('p.font-bold');
      expect(title?.textContent || '').toMatch(exp.titleMatch);

      // Descrição (segundo <p>, com classes leading-snug)
      const description = card.querySelector('p.leading-snug, p:not(.font-bold)');
      const descText = description?.textContent || '';
      for (const re of exp.descMustInclude) {
        expect(descText, `desc deve incluir ${re}`).toMatch(re);
      }
      for (const re of exp.descMustNotInclude) {
        expect(descText, `desc NÃO deve incluir ${re}`).not.toMatch(re);
      }

      // CTA
      const cta = screen.getByTestId('provider-integrity-primary-cta');
      expect(cta.textContent || '').toMatch(exp.ctaMatch);
    });
  }

  it('títulos dos 3 kinds são DISTINTOS entre si (sem texto genérico)', async () => {
    const titles = new Map<ProviderIntegrityKind, string>();

    for (const msg of [
      'PROVIDER_INCOMPLETE_NEIGHBORHOOD',
      'PROVIDER_INCOMPLETE_COORDS',
      'PROVIDER_INCOMPLETE_CITY',
    ]) {
      const { unmount } = renderWith({ location_source: 'ip' });
      const parsed = parseProviderIntegrityError({ code: '22023', message: msg });
      if (!parsed.matched) continue;
      fireEvent(
        window,
        new CustomEvent('wizard:provider-integrity-error', { detail: parsed }),
      );
      const card = await screen.findByTestId('provider-integrity-error-card');
      const title = card.querySelector('p.font-bold')?.textContent?.trim() || '';
      titles.set(parsed.kind, title);
      unmount();
    }

    expect(titles.size).toBe(3);
    const values = Array.from(titles.values());
    // Nenhum título vazio.
    for (const t of values) expect(t.length).toBeGreaterThan(0);
    // Todos os 3 títulos distintos entre si.
    expect(new Set(values).size).toBe(3);
  });

  it('descrição menciona um EXEMPLO concreto do campo (acionável, não genérico)', async () => {
    const cases: Array<[string, RegExp]> = [
      // Exemplos de bairros reais
      ['PROVIDER_INCOMPLETE_NEIGHBORHOOD', /Centro|Batel|Água Verde|Vila/i],
      // Exemplo de cidade real
      ['PROVIDER_INCOMPLETE_CITY', /Curitiba\/PR|São Paulo|exemplo/i],
      // Coords menciona CEP como alternativa concreta
      ['PROVIDER_INCOMPLETE_COORDS', /CEP/i],
    ];

    for (const [msg, expected] of cases) {
      const { unmount } = renderWith({ location_source: 'ip' });
      const parsed = parseProviderIntegrityError({ code: '22023', message: msg });
      if (!parsed.matched) continue;
      fireEvent(
        window,
        new CustomEvent('wizard:provider-integrity-error', { detail: parsed }),
      );
      const card = await screen.findByTestId('provider-integrity-error-card');
      expect(card.textContent || '').toMatch(expected);
      unmount();
    }
  });
});
