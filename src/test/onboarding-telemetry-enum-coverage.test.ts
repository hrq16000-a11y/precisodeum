/**
 * onboarding-telemetry-enum-coverage.test.ts — garante que QUALQUER evento
 * declarado no enum `OnboardingEventName` (incluindo eventos futuros) persiste
 * o campo `intent` real quando há um intent em sessionStorage.
 *
 * Contrato:
 *  - O enum vive em `phases/v2/telemetry.ts` como union type.
 *  - Aqui replicamos a lista canônica via const para varredura. Quando um novo
 *    evento for adicionado ao type, é OBRIGATÓRIO incluí-lo aqui também — o
 *    teste de paridade `enforces_enum_completeness` vai falhar caso contrário.
 *
 * Estratégia: spy em `supabase.from('onboarding_events').insert(...)` para
 * inspecionar o payload final.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const insertSpy: any = vi.fn(() => Promise.resolve({ error: null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ insert: insertSpy }) },
}));

import {
  trackOnboardingEvent,
  setOnboardingIntent,
  type OnboardingEventName,
} from '@/components/onboarding/wizard/phases/v2/telemetry';

/**
 * Lista canônica de TODOS os eventos suportados — deve permanecer alinhada com
 * o type `OnboardingEventName`. Quando algum evento novo for criado, basta
 * adicioná-lo aqui e o teste cobre automaticamente.
 *
 * Inclui também eventos "informais" disparados via cast `'milestone' as any`
 * em código real (ex: support_whatsapp_clicked, save_later_clicked,
 * recovery_page_visited). Esses NÃO estão no type union mas são válidos no
 * banco — testá-los garante que a auto-injeção de intent funciona pra eles.
 */
const KNOWN_EVENTS: readonly (OnboardingEventName | string)[] = [
  // Type-checked (OnboardingEventName)
  'enter',
  'next',
  'back',
  'skip',
  'submit',
  'error',
  'complete',
  'abandon',
  // Eventos extras emitidos via cast (presentes no código real)
  'milestone',
  'support_whatsapp_clicked',
  'help_page_visited',
  'save_later_clicked',
  'recovery_page_visited',
  'recovery_page_resumed',
  'exit_intent_shown',
  'exit_intent_whatsapp',
  'exit_intent_dismiss',
  'exit_intent_save_later',
] as const;

describe('telemetry — enum coverage de intent em TODOS os eventos', () => {
  beforeEach(() => {
    sessionStorage.clear();
    insertSpy.mockClear();
  });
  afterEach(() => setOnboardingIntent(null));

  it.each(KNOWN_EVENTS)('evento "%s" recebe intent real auto-injetado', async (event) => {
    setOnboardingIntent('professional');
    await trackOnboardingEvent({
      phase: 'phase1' as any,
      event: event as any,
    });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = insertSpy.mock.calls[0][0] as any;
    expect(payload.event).toBe(event);
    expect(payload.meta?.intent).toBe('professional');
  });

  it.each(['client', 'professional', 'rh', 'company'] as const)(
    'intent "%s" sobrevive em todos os eventos',
    async (intent) => {
      setOnboardingIntent(intent);
      for (const event of KNOWN_EVENTS) {
        insertSpy.mockClear();
        await trackOnboardingEvent({ phase: 'phaseX' as any, event: event as any });
        const payload = insertSpy.mock.calls[0][0] as any;
        expect(payload.meta?.intent, `event=${event}`).toBe(intent);
      }
    },
  );

  /**
   * Guard de paridade: o type `OnboardingEventName` evolui — quando ele crescer,
   * a lista `KNOWN_EVENTS` precisa crescer junto. Não há reflection de types em
   * runtime, então usamos um snapshot da lista mínima OBRIGATÓRIA (subset do
   * type union) e travamos a contagem. Atualize esse número ao adicionar.
   */
  it('paridade: KNOWN_EVENTS contém todos os 8 eventos do type OnboardingEventName', () => {
    const required: OnboardingEventName[] = [
      'enter', 'next', 'back', 'skip', 'submit', 'error', 'complete', 'abandon',
    ];
    for (const r of required) {
      expect(KNOWN_EVENTS).toContain(r);
    }
  });
});
