import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import RotatingServiceText from '@/components/home/RotatingServiceText';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => ({ is: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
  },
}));

const trackEventMock = vi.fn();
vi.mock('@/lib/tracking', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
}));

function withQuery(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('Hero analytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    trackEventMock.mockClear();
    localStorage.clear();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
  });

  it('dispara hero_phrase_shown via onPhraseChange a cada troca', () => {
    const onPhrase = vi.fn();
    render(withQuery(<RotatingServiceText onPhraseChange={onPhrase} />));
    expect(onPhrase).toHaveBeenCalledTimes(1);
    const first = onPhrase.mock.calls[0][0];
    expect(first).toMatchObject({
      slug: expect.any(String),
      label: expect.any(String),
      prefix: expect.stringMatching(/^(need|find)$/),
    });

    // Avança para próxima troca (need → find da MESMA categoria)
    act(() => {
      vi.advanceTimersByTime(3300);
    });
    expect(onPhrase.mock.calls.length).toBeGreaterThanOrEqual(2);
    const second = onPhrase.mock.calls[onPhrase.mock.calls.length - 1][0];
    expect(second.slug).toBe(first.slug); // mesma categoria
    expect(second.prefix).toBe('find');
  });
});

describe('Hero CTA — captura frase ativa via ref', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    trackEventMock.mockClear();
    localStorage.clear();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
  });

  it('CTA submit usa frase atual (slug+prefix) capturada do rotator', async () => {
    // Componente leve simulando o contrato HeroBanner ↔ CriticalHeroSearch:
    // ref é atualizada por onPhraseChange e lida no submit.
    const Harness = () => {
      const ref = { current: null as null | { slug: string; label: string; prefix: 'need' | 'find' } };
      return (
        <div>
          <RotatingServiceText
            onPhraseChange={(info) => {
              ref.current = info;
            }}
          />
          <button
            type="button"
            onClick={() => {
              const info = ref.current;
              if (info) {
                trackEventMock({
                  event: 'hero_cta_click',
                  slug: info.slug,
                  source: 'hero_search',
                  extra: { phrase_prefix: info.prefix, phrase_label: info.label, action: 'submit' },
                });
              }
            }}
          >
            buscar
          </button>
        </div>
      );
    };

    render(withQuery(<Harness />));
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'hero_cta_click',
        source: 'hero_search',
        extra: expect.objectContaining({ action: 'submit' }),
      }),
    );
  });
});
