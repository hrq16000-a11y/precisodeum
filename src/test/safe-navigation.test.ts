import { describe, expect, it, vi } from 'vitest';
import { openSafeUrlInNewTab, resolveSafeNavigationTarget } from '@/lib/safeNavigation';

describe('safe navigation', () => {
  it('accepts internal paths and preserves query and hash', () => {
    expect(resolveSafeNavigationTarget('/vagas?q=eletricista#topo')?.internalPath)
      .toBe('/vagas?q=eletricista#topo');
  });

  it('accepts external HTTPS URLs', () => {
    const target = resolveSafeNavigationTarget('https://example.com/path');
    expect(target?.href).toBe('https://example.com/path');
    expect(target?.internalPath).toBeNull();
  });

  it.each(['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test'])('rejects unsafe URL %s', (url) => {
    expect(resolveSafeNavigationTarget(url)).toBeNull();
  });

  it('opens a new tab without opener access', () => {
    const popup = { opener: window } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(popup);

    expect(openSafeUrlInNewTab('https://example.com')).toBe(true);
    expect(open).toHaveBeenCalledWith('https://example.com/', '_blank', 'noopener,noreferrer');
    expect(popup.opener).toBeNull();
  });
});
