/**
 * Garante que o campo `intent` real do usuário é injetado em TODOS os tipos
 * de evento de onboarding (enter, next, back, skip, submit, error, complete).
 *
 * Estratégia: spy no `supabase.from('onboarding_events').insert(...)` e
 * verificar o payload final que sairia para o banco.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const insertSpy = vi.fn(() => Promise.resolve({ error: null }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ insert: insertSpy }),
  },
}));

import {
  trackOnboardingEvent,
  setOnboardingIntent,
  type OnboardingEventName,
} from '@/components/onboarding/wizard/phases/v2/telemetry';

const ALL_EVENTS: OnboardingEventName[] = [
  'enter', 'next', 'back', 'skip', 'submit', 'error', 'complete', 'abandon',
];

describe('telemetry — intent é sticky em todos os eventos', () => {
  beforeEach(() => {
    sessionStorage.clear();
    insertSpy.mockClear();
  });

  afterEach(() => {
    setOnboardingIntent(null);
  });

  it.each(ALL_EVENTS)('evento "%s" carrega intent do sessionStorage no meta', async (event) => {
    setOnboardingIntent('professional');

    await trackOnboardingEvent({
      phase: 'phase1' as any,
      event,
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.event).toBe(event);
    expect(payload.meta).toBeDefined();
    expect(payload.meta.intent).toBe('professional');
  });

  it('respeita intent explicitamente passado em opts (override do sessionStorage)', async () => {
    setOnboardingIntent('professional');

    await trackOnboardingEvent({
      phase: 'phase2' as any,
      event: 'submit',
      intent: 'client',
    });

    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.meta.intent).toBe('client');
  });

  it('não sobrescreve intent quando já presente no meta original', async () => {
    setOnboardingIntent('professional');

    await trackOnboardingEvent({
      phase: 'phase3' as any,
      event: 'milestone' as any,
      meta: { intent: 'rh', step: 'first_service' },
    });

    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.meta.intent).toBe('rh');
    expect(payload.meta.step).toBe('first_service');
  });

  it('omite intent quando nada está definido (não envia "unknown")', async () => {
    await trackOnboardingEvent({
      phase: 'phase1' as any,
      event: 'enter',
    });

    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.meta).toBeDefined();
    expect('intent' in payload.meta).toBe(false);
  });
});
