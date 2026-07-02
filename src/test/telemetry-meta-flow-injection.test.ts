/**
 * Testes da padronização de `meta.flow` em `trackOnboardingEvent`.
 *
 * Garantias auditadas:
 *  1. Quando o caller fornece `meta.flow` explicitamente, o valor é preservado.
 *  2. Quando o caller NÃO fornece `meta.flow`, lemos do sticky em sessionStorage
 *     (definido pelo shell via `setOnboardingFlow`).
 *  3. Quando nem caller nem sticky têm flow, cai no fallback `'unknown'`
 *     — explícito para que dashboards consigam detectar callers sem contexto.
 *  4. `meta.intent` também é injetado a partir do sticky `setOnboardingIntent`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock do client Supabase: capturamos os payloads inseridos em onboarding_events.
const insertSpy = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: (payload: unknown) => {
        insertSpy(payload);
        return Promise.resolve({ data: null, error: null });
      },
    }),
  },
}));

import {
  trackOnboardingEvent,
  setOnboardingFlow,
  setOnboardingIntent,
} from '@/components/onboarding/wizard/phases/v2/telemetry';

beforeEach(() => {
  insertSpy.mockClear();
  sessionStorage.clear();
});
afterEach(() => {
  sessionStorage.clear();
});

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('telemetry — meta.flow injection', () => {
  it('preserva meta.flow fornecido explicitamente pelo caller', async () => {
    setOnboardingFlow('default'); // sticky diferente para garantir que NÃO sobrescreve
    await trackOnboardingEvent({
      phase: 'phase2_service',
      event: 'next',
      userId: 'u1',
      meta: { flow: 'company', custom: 1 },
    });
    await flushMicrotasks();
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.meta.flow).toBe('company');
    expect(payload.meta.custom).toBe(1);
  });

  it('injeta meta.flow do sticky quando o caller omite', async () => {
    setOnboardingFlow('company');
    await trackOnboardingEvent({
      phase: 'main_contact',
      event: 'enter',
      userId: 'u1',
    });
    await flushMicrotasks();
    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.meta.flow).toBe('company');
  });

  it('cai em "unknown" quando nem caller nem sticky têm flow', async () => {
    // sessionStorage limpo no beforeEach
    await trackOnboardingEvent({
      phase: 'main_contact',
      event: 'enter',
      userId: 'u1',
    });
    await flushMicrotasks();
    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.meta.flow).toBe('unknown');
  });

  it('injeta meta.intent do sticky quando o caller omite', async () => {
    setOnboardingFlow('default');
    setOnboardingIntent('company');
    await trackOnboardingEvent({
      phase: 'phase2_service',
      event: 'submit',
      userId: 'u1',
    });
    await flushMicrotasks();
    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.meta.intent).toBe('company');
    expect(payload.meta.flow).toBe('default'); // não sobrescreve
  });

  it('preserva meta.intent fornecido pelo caller mesmo com sticky setado', async () => {
    setOnboardingIntent('company');
    await trackOnboardingEvent({
      phase: 'phase2_service',
      event: 'submit',
      userId: 'u1',
      meta: { intent: 'professional' },
    });
    await flushMicrotasks();
    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.meta.intent).toBe('professional');
  });
});
