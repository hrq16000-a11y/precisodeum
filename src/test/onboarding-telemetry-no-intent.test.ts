/**
 * onboarding-telemetry-no-intent.test.ts
 *
 * Quando o usuário ainda não escolheu intent (sessionStorage vazio), os
 * eventos de telemetria devem:
 *   - persistir sem o campo `intent` em `meta` (NÃO enviar string "unknown")
 *   - manter o resto do payload válido para o schema da tabela onboarding_events
 *     (user_id, session_id, variant, phase, event, meta)
 *
 * Garante consistência: nada de `intent: undefined` quebrando o JSON,
 * nada de `null` em locais inesperados.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const insertSpy: any = vi.fn(() => Promise.resolve({ error: null }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ insert: insertSpy }) },
}));

import {
  trackOnboardingEvent,
  setOnboardingIntent,
  type OnboardingEventName,
} from '@/components/onboarding/wizard/phases/v2/telemetry';

const ALL_EVENTS: OnboardingEventName[] = [
  'enter', 'next', 'back', 'skip', 'submit', 'error', 'complete', 'abandon',
];

const REQUIRED_KEYS = ['user_id', 'session_id', 'variant', 'phase', 'event', 'meta'] as const;

describe('telemetry — intent ausente (sessionStorage vazio)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    insertSpy.mockClear();
    setOnboardingIntent(null);
  });

  afterEach(() => {
    setOnboardingIntent(null);
  });

  it.each(ALL_EVENTS)('evento "%s" não inclui intent quando não há intent definido', async (event) => {
    await trackOnboardingEvent({ phase: 'phase1' as any, event });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = insertSpy.mock.calls[0][0] as any;

    // Schema mínimo presente
    for (const k of REQUIRED_KEYS) {
      expect(payload, `payload sem chave ${k}`).toHaveProperty(k);
    }
    // intent não presente nem como string nem como null
    expect('intent' in payload.meta).toBe(false);
    // meta serializa para JSON sem undefined órfãos
    const json = JSON.stringify(payload);
    expect(json).not.toContain('"intent":"unknown"');
    expect(json).not.toContain('"intent":null');
    expect(json).not.toContain('"intent":undefined');
  });

  it('payload é JSON.stringifiable e roundtrip-stable mesmo sem intent', async () => {
    await trackOnboardingEvent({ phase: 'phase2' as any, event: 'submit', meta: { step: 1 } });
    const payload = insertSpy.mock.calls[0][0] as any;
    const round = JSON.parse(JSON.stringify(payload));
    expect(round).toEqual(payload);
    expect(round.meta.step).toBe(1);
  });

  it('intent explícito null no opts NÃO injeta campo intent', async () => {
    await trackOnboardingEvent({
      phase: 'phase1' as any,
      event: 'enter',
      intent: null,
    });
    const payload = insertSpy.mock.calls[0][0] as any;
    expect('intent' in payload.meta).toBe(false);
  });

  it('depois que intent é setado, eventos passam a carregá-lo (transição limpa)', async () => {
    // Sem intent
    await trackOnboardingEvent({ phase: 'phase1' as any, event: 'enter' });
    let payload = insertSpy.mock.calls[0][0] as any;
    expect('intent' in payload.meta).toBe(false);

    // Usuário escolhe profissional → próximos eventos carregam intent
    setOnboardingIntent('professional');
    await trackOnboardingEvent({ phase: 'phase1' as any, event: 'next' });
    payload = insertSpy.mock.calls[1][0] as any;
    expect(payload.meta.intent).toBe('professional');
  });
});
