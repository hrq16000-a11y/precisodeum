// Helpers for avatar fallback initials and social-avatar sync.

/** Extracts up to 2 uppercase initials from a name. "João da Silva" → "JS". */
export function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    // Skip lowercase connectors like "da", "de", "dos"
    .filter((w, i, arr) => i === 0 || i === arr.length - 1 || w[0] === w[0]?.toUpperCase());
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Reads a Google/social avatar URL from the auth user metadata.
 * Returns null when no usable URL is found.
 */
export function getSocialAvatarUrl(user: any): string | null {
  const meta = user?.user_metadata || {};
  const candidates = [meta.avatar_url, meta.picture, meta.photoURL];
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c;
  }
  return null;
}
