/**
 * Renders a Boring Avatar (https://github.com/boringdesigners/boring-avatars)
 * as a stable `data:image/svg+xml` URL so it can be used as a normal `<img src>`
 * inside our existing Avatar / ProviderCard pipelines — without forcing every
 * call-site to switch to a React component.
 *
 * Why a data URL:
 *  - `resolveAvatarUrl()` returns `string` (URL). Keeping that contract avoids
 *    rewriting every consumer.
 *  - Generated SVG is deterministic per (variant + seed + palette), so render
 *    is cached in-memory by key.
 *
 * Bundle cost: react-dom/server is already part of the React 18 client build;
 * boring-avatars itself is ~5KB gzipped.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Avatar from 'boring-avatars';

export type BoringVariant = 'marble' | 'beam' | 'pixel' | 'sunset' | 'ring' | 'bauhaus';

const cache = new Map<string, string>();
const MAX_CACHE = 500;

export function buildBoringAvatarDataUrl(opts: {
  variant: BoringVariant;
  seed: string;
  colors: string[];
  size?: number;
  square?: boolean;
}): string {
  const variant = opts.variant || 'marble';
  const size = opts.size ?? 200;
  const square = opts.square ?? true;
  const colors = (opts.colors && opts.colors.length > 0)
    ? opts.colors
    : ['#1e3a8a', '#0f766e', '#7c2d12', '#4338ca', '#166534'];
  const key = `${variant}|${size}|${square ? 'sq' : 'rd'}|${colors.join(',')}|${opts.seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const element = createElement(Avatar as any, {
    size,
    name: opts.seed,
    variant,
    colors,
    square,
  });
  const svg = renderToStaticMarkup(element);
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  if (cache.size > MAX_CACHE) {
    // Drop oldest entry — Map preserves insertion order.
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, url);
  return url;
}
