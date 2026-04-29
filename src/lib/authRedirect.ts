export const DEFAULT_AUTH_NEXT = '/dashboard';

export const sanitizeNextPath = (
  candidate: string | null | undefined,
  fallback: string = DEFAULT_AUTH_NEXT,
): string => {
  if (!candidate || typeof candidate !== 'string') return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  return candidate;
};

export const buildLoginUrl = (
  next?: string | null,
  message?: string | null,
  origin: string = 'http://localhost',
): string => {
  const url = new URL('/login', origin);
  const safeNext = next ? sanitizeNextPath(next, '') : '';
  const trimmedMessage = message?.trim();

  if (safeNext) url.searchParams.set('next', safeNext);
  if (trimmedMessage) url.searchParams.set('message', trimmedMessage);

  return `${url.pathname}${url.search}`;
};

export const readLoginContext = (input: {
  search: string;
  state?: { from?: unknown; message?: unknown } | null;
}) => {
  const params = new URLSearchParams(input.search);
  const nextFromState = typeof input.state?.from === 'string' ? input.state.from : null;
  const nextFromSearch = params.get('next');
  const messageFromState = typeof input.state?.message === 'string' ? input.state.message : null;
  const messageFromSearch = params.get('message');

  return {
    next: sanitizeNextPath(nextFromState ?? nextFromSearch, DEFAULT_AUTH_NEXT),
    message: (messageFromState ?? messageFromSearch ?? '').trim(),
  };
};