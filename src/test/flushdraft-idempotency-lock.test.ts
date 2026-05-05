/**
 * Lock de idempotência em flushRemoteDraft — race conditions em rede lenta.
 *
 * Garantias:
 *  1. Múltiplas chamadas concorrentes coalescem em 1 único UPDATE.
 *  2. Após resolver, o dedupe de 2s bloqueia o próximo upsert.
 *  3. O evento global `onboarding:remote-flush:start/end` é emitido 1 vez.
 *  4. Usuários diferentes não compartilham o lock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushRemoteDraft,
  __resetRemoteDraftDedupe,
  __resetRemoteDraftInFlight,
  isFlushingRemoteDraft,
} from '@/components/onboarding/wizard/phases/v2/flushDraft';

const upsertCalls: any[] = [];
const upsertResolvers: ((v: any) => void)[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: (payload: any) => {
        upsertCalls.push(payload);
        return new Promise((resolve) => {
          upsertResolvers.push(resolve);
        });
      },
    }),
  },
}));

const sampleState: any = {
  phase: 'phase4_extras_b',
  profile: { city: 'Curitiba', state: 'PR', neighborhood: 'Centro' },
  service: {},
  userRef: 'ref-1',
  providerId: 'p-1',
  firstServiceId: 's-1',
};

function flushAllResolvers() {
  while (upsertResolvers.length > 0) {
    upsertResolvers.shift()?.({ data: null, error: null });
  }
}

beforeEach(() => {
  upsertCalls.length = 0;
  upsertResolvers.length = 0;
  __resetRemoteDraftDedupe();
  __resetRemoteDraftInFlight();
});
afterEach(() => {
  __resetRemoteDraftDedupe();
  __resetRemoteDraftInFlight();
});

describe('flushRemoteDraft — lock de idempotência', () => {
  it('coalesce chamadas concorrentes em 1 único UPDATE + 1 par de eventos', async () => {
    const startEvents: number[] = [];
    const endEvents: number[] = [];
    const onStart = () => startEvents.push(1);
    const onEnd = () => endEvents.push(1);
    window.addEventListener('onboarding:remote-flush:start', onStart);
    window.addEventListener('onboarding:remote-flush:end', onEnd);

    try {
      const p1 = flushRemoteDraft(sampleState, 'user-X');
      const p2 = flushRemoteDraft(sampleState, 'user-X');
      const p3 = flushRemoteDraft(sampleState, 'user-X');

      expect(isFlushingRemoteDraft('user-X')).toBe(true);
      expect(upsertCalls.length).toBe(1);

      flushAllResolvers();
      await Promise.all([p1, p2, p3]);

      expect(upsertCalls.length).toBe(1);
      expect(isFlushingRemoteDraft('user-X')).toBe(false);
      expect(startEvents.length).toBe(1);
      expect(endEvents.length).toBe(1);
    } finally {
      window.removeEventListener('onboarding:remote-flush:start', onStart);
      window.removeEventListener('onboarding:remote-flush:end', onEnd);
    }
  });

  it('após resolver, dedupe de 2s bloqueia o próximo upsert', async () => {
    const p1 = flushRemoteDraft(sampleState, 'user-Y');
    flushAllResolvers();
    await p1;
    expect(upsertCalls.length).toBe(1);

    await flushRemoteDraft(sampleState, 'user-Y');
    expect(upsertCalls.length).toBe(1);
  });

  it('usuários diferentes não compartilham o lock', async () => {
    const pA = flushRemoteDraft(sampleState, 'user-A');
    const pB = flushRemoteDraft(sampleState, 'user-B');
    expect(upsertCalls.length).toBe(2);
    flushAllResolvers();
    await Promise.all([pA, pB]);
  });
});
