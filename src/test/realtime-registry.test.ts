/**
 * PR 6 · realtimeRegistry — contrato mínimo de governança.
 *
 * Trava:
 *  - refcount: 2 acquires no mesmo nome reutilizam o canal e só removem após 2 releases;
 *  - dispose-delay: 1 release + 1 acquire imediato cancela a remoção pendente;
 *  - setup chamado apenas na primeira aquisição;
 *  - cleanup final chama removeChannel uma única vez por canal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const subscribeMock = vi.fn(() => fakeChannel);
const onMock = vi.fn(() => fakeChannel);
const fakeChannel: any = { on: onMock, subscribe: subscribeMock };

const channelFactory = vi.fn((_name: string) => fakeChannel);
const removeChannelMock = vi.fn((_ch: unknown) => undefined);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: (name: string) => channelFactory(name),
    removeChannel: (ch: unknown) => removeChannelMock(ch),
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  channelFactory.mockClear();
  removeChannelMock.mockClear();
  subscribeMock.mockClear();
  onMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('realtimeRegistry', () => {
  it('reusa canal entre acquires concorrentes (refcount)', async () => {
    const { acquireChannel, releaseChannel } = await import('@/lib/realtimeRegistry');
    const setup = vi.fn((ch) => ch);

    acquireChannel('pr6:test-refcount', { setup });
    acquireChannel('pr6:test-refcount', { setup });

    expect(channelFactory).toHaveBeenCalledTimes(1);
    expect(setup).toHaveBeenCalledTimes(1);
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    releaseChannel('pr6:test-refcount');
    vi.advanceTimersByTime(100);
    expect(removeChannelMock).not.toHaveBeenCalled();

    releaseChannel('pr6:test-refcount');
    vi.advanceTimersByTime(100);
    expect(removeChannelMock).toHaveBeenCalledTimes(1);
  });

  it('cancela dispose pendente se reacquired dentro da janela (StrictMode)', async () => {
    const { acquireChannel, releaseChannel } = await import('@/lib/realtimeRegistry');
    const setup = vi.fn((ch) => ch);

    acquireChannel('pr6:test-strict', { setup });
    releaseChannel('pr6:test-strict');
    // dispose agendado mas ainda não executou
    vi.advanceTimersByTime(10);
    acquireChannel('pr6:test-strict', { setup });
    vi.advanceTimersByTime(200);

    expect(channelFactory).toHaveBeenCalledTimes(1);
    expect(setup).toHaveBeenCalledTimes(1);
    expect(removeChannelMock).not.toHaveBeenCalled();

    releaseChannel('pr6:test-strict');
    vi.advanceTimersByTime(200);
    expect(removeChannelMock).toHaveBeenCalledTimes(1);
  });
});
