export interface SafeNavigationTarget {
  href: string;
  internalPath: string | null;
}

export function resolveSafeNavigationTarget(rawUrl: string): SafeNavigationTarget | null {
  const value = rawUrl.trim();
  if (!value || typeof window === 'undefined') return null;

  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    return {
      href: url.href,
      internalPath: url.origin === window.location.origin
        ? `${url.pathname}${url.search}${url.hash}`
        : null,
    };
  } catch {
    return null;
  }
}

export function openSafeUrlInNewTab(rawUrl: string): boolean {
  const target = resolveSafeNavigationTarget(rawUrl);
  if (!target) return false;

  const opened = window.open(target.href, '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
  return true;
}
