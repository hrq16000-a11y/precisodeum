/**
 * Lock de idempotência em flushRemoteDraft — race conditions em rede lenta.
 *
 * Cenário-alvo: usuário clica Voltar várias vezes rapidamente. Sem o lock,
 * cada clique disparava um UPDATE concorrente; a 2ª resposta podia chegar
 * depois da 1ª e sobrescrever campos mais novos com snapshot antigo.
 *
 * Garantias verificadas:
 *  1. Múltiplas chamadas concorrentes resolvem a MESMA Promise (1 UPDATE).
 *  2. Após resolver, o dedupe de 2s bloqueia o próximo upsert (skipped).
 *  3. O evento global `onboarding:remote-flush:start/end` é emitido 1 vez.
 *  4. Lock libera após resolução (próxima chamada após 2s passa de novo).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushRemoteDraft,
  __resetRemoteDraftDedupe,
  __resetRemoteDraftInFlight,
  isFlushingRemoteDraft,
} from '@/components/onboarding/wizard/phases/v2/flushDraft';

const upsertCalls: any[] = [];
let upsertResolver: ((v: any) => void) | null = null;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: (payload: any) => {
        upsertCalls.push(payload);
        return new Promise((resolve) => {
          upsertResolver = resolve;
        });
      },
    }),
  },
}));

const sampleState = {
  phase: 'phase4_extras_b' as const,
  profile: { city: 'Curitiba', state: 'PR', neighborhood: 'Centro' } as any,
  service: {} as any,
  userRef: 'ref-1',
  providerId: 'p-1',
  firstServiceId: 's-1',
} as any;

beforeEach(() => {
  upsertCalls.length = 0;
  upsertResolver = null;
  __resetRemoteDraftDedupe();
  __resetRemoteDraftInFlight();
});
afterEach(() => {
  __resetRemoteDraftDedupe();
  __resetRemoteDraftInFlight();
});

describe('flushRemoteDraft — lock de idempotência', () => {
  it('coalesce chamadas concorrentes em 1 único UPDATE', async () => {
    const startEvents: any[] = [];
    const endEvents: any[] = [];
    window.addEventListener('onboarding:remote-flush:start', () => startEvents.push(1));
    window.addEventListener('onboarding:remote-flush:end', () => endEvents.push(1));

    const p1 = flushRemoteDraft(sampleState, 'user-X');
    const p2 = flushRemoteDraft(sampleState, 'user-X');
    const p3 = flushRemoteDraft(sampleState, 'user-X');

    expect(isFlushingRemoteDraft('user-X')).toBe(true);
    expect(upsertCalls.length).toBe(1);

    upsertResolver?.({ data: null, error: null });
    await Promise.all([p1, p2, p3]);

    expect(upsertCalls.length).toBe(1);
    expect(isFlushingRemoteDraft('user-X')).toBe(false);
    expect(startEvents.length).toBe(1);
    expect(endEvents.length).toBe(1);
  });

  it('após resolver, o dedupe de 2s bloqueia o próximo upsert', async () => {
    const p1 = flushRemoteDraft(sampleState, 'user-Y');
    upsertResolver?.({ data: null, error: null });
    await p1;
    expect(upsertCalls.length).toBe(1);

    // 2ª chamada imediata — deve ser skipped pelo dedupe (não in-flight).
    await flushRemoteDraft(sampleState, 'user-Y');
    expect(upsertCalls.length).toBe(1);
  });

  it('usuários diferentes não compartilham o lock', async () => {
    // Captura todos os resolvers para usuários distintos (2 UPDATEs concorrentes).
    const resolvers: ((v: any) => void)[] = [];
    const origResolver = upsertResolver;
    void origResolver;
    const captureNext = () => new Promise<(v: any) => void>((res) => {
      const id = setInterval(() => {
        if (upsertResolver) {
          const r = upsertResolver;
          upsertResolver = null;
          clearInterval(id);
          res(r);
        }
      }, 5);
    });
    const pA = flushRemoteDraft(sampleState, 'user-A');
    const r1 = await captureNext();
    resolvers.push(r1);
    const pB = flushRemoteDraft(sampleState, 'user-B');
    const r2 = await captureNext();
    resolvers.push(r2);
    expect(upsertCalls.length).toBe(2);
    resolvers.forEach((r) => r({ data: null, error: null }));
    await Promise.all([pA, pB]);
  });
});
