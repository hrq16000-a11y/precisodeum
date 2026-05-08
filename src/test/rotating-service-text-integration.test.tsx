import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RotatingServiceText from '@/components/home/RotatingServiceText';
import {
  RECENT_HISTORY_KEY,
  pickNextOrder,
  buildPhrase,
  defaultRandom,
} from '@/lib/heroPhraseGenerator';

// Mock supabase client → sempre retorna lista vazia para forçar fallback ao
// HERO_CATEGORY_POOL hardcoded. Isso torna o teste determinístico sem rede.
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

  it('renderiza prefixo + serviço com gênero/contração corretos no primeiro frame', () => {
    renderRotator();
    const el = screen.getByTestId('hero-rotating-text');
    const article = el.getAttribute('data-current-article');
    const prefixKind = el.getAttribute('data-current-prefix');
    expect(article === 'um' || article === 'uma').toBe(true);
    expect(prefixKind).toBe('need');

    const text = el.textContent || '';
    if (article === 'um') {
      expect(text.startsWith('Preciso de um ')).toBe(true);
    } else {
      expect(text.startsWith('Preciso de uma ')).toBe(true);
    }
    // Nunca deve usar contração inválida
    expect(text).not.toMatch(/dum|duma/);
  });

  it('alterna para "Encontre um/a !" preservando concordância da MESMA categoria', async () => {
    renderRotator();
    const el = screen.getByTestId('hero-rotating-text');
    const slugAntes = el.getAttribute('data-current-slug');
    const articleAntes = el.getAttribute('data-current-article');

    await act(async () => { vi.advanceTimersByTime(2700); });

    expect(el.getAttribute('data-current-slug')).toBe(slugAntes);
    expect(el.getAttribute('data-current-article')).toBe(articleAntes);
    expect(el.getAttribute('data-current-prefix')).toBe('find');

    const text = el.textContent || '';
    expect(text).toMatch(/^Encontre (um|uma) /);
    expect(text.endsWith('!')).toBe(true);
  });

  it('grava cada slug exibido em localStorage para cooldown entre visitas', async () => {
    renderRotator();
    const el = screen.getByTestId('hero-rotating-text');
    const slug1 = el.getAttribute('data-current-slug')!;

    // Aguarda 1 ciclo completo (need → find → próxima categoria)
    await act(async () => { vi.advanceTimersByTime(2700); }); // → find
    await act(async () => { vi.advanceTimersByTime(2700); }); // → próxima
    const slug2 = el.getAttribute('data-current-slug')!;

    const raw = localStorage.getItem(RECENT_HISTORY_KEY);
    expect(raw).toBeTruthy();
    const history = JSON.parse(raw!);
    expect(Array.isArray(history)).toBe(true);
    expect(history).toContain(slug1);
    expect(history).toContain(slug2);
    // Sem duplicatas
    expect(new Set(history).size).toBe(history.length);
  });

  it('notifica onPhraseChange a cada troca de prefixo OU categoria', async () => {
    const onPhrase = vi.fn();
    renderRotator({ onPhraseChange: onPhrase });

    expect(onPhrase).toHaveBeenCalledTimes(1);
    expect(onPhrase.mock.calls[0][0].prefix).toBe('need');

    await act(async () => { vi.advanceTimersByTime(2700); });
    expect(onPhrase).toHaveBeenCalledTimes(2);
    expect(onPhrase.mock.calls[1][0].prefix).toBe('find');
    expect(onPhrase.mock.calls[1][0].slug).toBe(onPhrase.mock.calls[0][0].slug);

    await act(async () => { vi.advanceTimersByTime(2700); });
    expect(onPhrase).toHaveBeenCalledTimes(3);
    expect(onPhrase.mock.calls[2][0].prefix).toBe('need');
    expect(onPhrase.mock.calls[2][0].slug).not.toBe(onPhrase.mock.calls[0][0].slug);
  });

  it('usa o gerador buildPhrase (concordância sempre via lib, nunca hardcoded)', () => {
    renderRotator();
    const el = screen.getByTestId('hero-rotating-text');
    const slug = el.getAttribute('data-current-slug')!;
    const article = el.getAttribute('data-current-article')!;
    const prefixKind = el.getAttribute('data-current-prefix') as 'need' | 'find';

    // O texto renderizado deve ser idêntico ao produzido por buildPhrase
    const expected = buildPhrase({ slug, label: '', article: article as 'um' | 'uma' }, prefixKind);
    const text = el.textContent || '';
    expect(text.startsWith(expected.prefix + ' ')).toBe(true);
  });

  it('mantém uma única linha (whitespace-nowrap) no markup (mobile e desktop)', () => {
    renderRotator();
    const el = screen.getByTestId('hero-rotating-text');
    expect(el.className).toMatch(/whitespace-nowrap/);
    expect(el.className).toMatch(/flex-nowrap/);
  });
});

describe('heroPhraseGenerator · SSR safety', () => {
  it('defaultRandom é determinístico quando window é undefined', () => {
    const original = (globalThis as { window?: unknown }).window;
    // Simula SSR
    delete (globalThis as { window?: unknown }).window;
    try {
      const r1 = defaultRandom();
      const r2 = defaultRandom();
      // Mesma semente → mesma sequência
      const a = [r1(), r1(), r1()];
      const b = [r2(), r2(), r2()];
      expect(a).toEqual(b);
    } finally {
      (globalThis as { window?: unknown }).window = original;
    }
  });

  it('pickNextOrder não quebra sem storage e produz ordem estável c/ random determinístico', () => {
    const pool = [
      { slug: 'a', label: 'a' },
      { slug: 'b', label: 'b' },
      { slug: 'c', label: 'c' },
    ];
    const seq = [0.1, 0.5, 0.9, 0.2, 0.7];
    let i = 0;
    const random = () => seq[i++ % seq.length];

    const r1 = pickNextOrder(pool, { storage: null, random, seedHistory: [] });
    i = 0;
    const r2 = pickNextOrder(pool, { storage: null, random, seedHistory: [] });

    expect(r1.order.map((c) => c.slug)).toEqual(r2.order.map((c) => c.slug));
    expect(r1.order.length).toBe(3);
  });
});
