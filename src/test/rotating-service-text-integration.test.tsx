import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RotatingServiceText from '@/components/home/RotatingServiceText';
import {
  RECENT_HISTORY_KEY,
  pickNextOrder,
  buildPhrase,
  makeSeededRandom,
} from '@/lib/heroPhraseGenerator';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => ({
          is: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

function renderRotator(props: Parameters<typeof RotatingServiceText>[0] = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RotatingServiceText {...props} />
    </QueryClientProvider>,
  );
}

describe('RotatingServiceText · integração', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
  });

  it('expõe sempre artigo válido (um|uma) e prefixo (need|find) via data-attrs', () => {
    renderRotator();
    const el = screen.getByTestId('hero-rotating-text');
    const article = el.getAttribute('data-current-article');
    const prefixKind = el.getAttribute('data-current-prefix');
    expect(['um', 'uma']).toContain(article);
    expect(['need', 'find']).toContain(prefixKind);
  });

  it('texto começa com "Preciso de um/uma " ou "Encontre um/uma " sem contração inválida', () => {
    renderRotator();
    const el = screen.getByTestId('hero-rotating-text');
    const text = el.textContent || '';
    expect(text).toMatch(/^(Preciso de|Encontre) (um|uma) /);
    expect(text).not.toMatch(/\b(dum|duma|do |da )/);
  });

  it('sincroniza localStorage a cada categoria mostrada (cooldown entre visitas)', async () => {
    renderRotator();
    // Aguarda algumas trocas
    await act(async () => { vi.advanceTimersByTime(2700 * 4); });
    const raw = localStorage.getItem(RECENT_HISTORY_KEY);
    expect(raw).toBeTruthy();
    const history = JSON.parse(raw!);
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
    expect(new Set(history).size).toBe(history.length); // sem dup
  });

  it('notifica onPhraseChange com slug+label+prefix em cada troca', () => {
    const onPhrase = vi.fn();
    renderRotator({ onPhraseChange: onPhrase });
    expect(onPhrase).toHaveBeenCalled();
    const arg = onPhrase.mock.calls[0][0];
    expect(arg).toHaveProperty('slug');
    expect(arg).toHaveProperty('label');
    expect(['need', 'find']).toContain(arg.prefix);
  });

  it('texto renderizado bate com saída do gerador buildPhrase (mesma fonte)', () => {
    renderRotator();
    const el = screen.getByTestId('hero-rotating-text');
    const article = el.getAttribute('data-current-article') as 'um' | 'uma';
    const prefixKind = el.getAttribute('data-current-prefix') as 'need' | 'find';
    const expected = buildPhrase({ slug: 'x', label: 'x', article }, prefixKind);
    const text = el.textContent || '';
    expect(text.startsWith(expected.prefix + ' ')).toBe(true);
  });

  it('mantém whitespace-nowrap + flex-nowrap (uma linha em mobile e desktop)', () => {
    renderRotator();
    const el = screen.getByTestId('hero-rotating-text');
    expect(el.className).toMatch(/whitespace-nowrap/);
    expect(el.className).toMatch(/flex-nowrap/);
  });
});

describe('heroPhraseGenerator · SSR/determinismo', () => {
  it('makeSeededRandom é determinístico para a mesma semente', () => {
    const r1 = makeSeededRandom(42);
    const r2 = makeSeededRandom(42);
    const a = [r1(), r1(), r1()];
    const b = [r2(), r2(), r2()];
    expect(a).toEqual(b);
  });

  it('pickNextOrder roda sem storage (storage:null) e é estável c/ random fixo', () => {
    const pool = [
      { slug: 'a', label: 'a' },
      { slug: 'b', label: 'b' },
      { slug: 'c', label: 'c' },
    ];
    const r1 = pickNextOrder(pool, { storage: null, random: makeSeededRandom(7), seedHistory: [] });
    const r2 = pickNextOrder(pool, { storage: null, random: makeSeededRandom(7), seedHistory: [] });
    expect(r1.order.map((c) => c.slug)).toEqual(r2.order.map((c) => c.slug));
    expect(r1.order.length).toBe(3);
  });
});
