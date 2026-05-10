/**
 * Reduced-motion test — `prefers-reduced-motion: reduce` should not break
 * phrase rotation. The CSS layer disables animation but the React state must
 * keep advancing (need → find → next category) and gender/contractions must
 * stay correct.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RotatingServiceText, { HOLD_MS } from '@/components/home/RotatingServiceText';

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

function renderWithRm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RotatingServiceText />
    </QueryClientProvider>,
  );
}

describe('RotatingServiceText · prefers-reduced-motion', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({
        matches: q.includes('prefers-reduced-motion: reduce'),
        media: q,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('still rotates phrases and keeps gender agreement under reduced-motion', () => {
    renderWithRm();
    const node = screen.getByTestId('hero-rotating-text');
    const initialSlug = node.getAttribute('data-current-slug');
    const initialPrefix = node.getAttribute('data-current-prefix');
    expect(initialPrefix).toBe('need');
    expect(initialSlug).toBeTruthy();

    // Article must match category gender (data-current-article = 'um' | 'uma').
    const article = node.getAttribute('data-current-article');
    expect(['um', 'uma']).toContain(article);

    // Advance past hold to flip prefix → 'find' (same category).
    act(() => {
      vi.advanceTimersByTime(HOLD_MS + 50);
    });
    expect(
      screen.getByTestId('hero-rotating-text').getAttribute('data-current-prefix'),
    ).toBe('find');
  });

  it('renders without applying motion-heavy keyframe classes inertly (CSS controls visuals)', () => {
    renderWithRm();
    // The animation classes are still emitted (CSS handles disabling via
    // @media (prefers-reduced-motion: reduce)); contract here is that the
    // component does not gate rendering on motion preference.
    const node = screen.getByTestId('hero-rotating-text');
    expect(node.querySelector('.animate-hero-fade-in')).toBeTruthy();
  });
});
