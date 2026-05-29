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
const STORAGE_PREFIX = 'bav:'; // boring-avatar v1
const STORAGE_INDEX_KEY = 'bav:index';
const STORAGE_MAX = 200; // sessionStorage budget (≈ <1MB total)

let storageHydrated = false;
function hydrateFromSessionStorage() {
  if (storageHydrated) return;
  storageHydrated = true;
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_INDEX_KEY);
    if (!raw) return;
    const keys = JSON.parse(raw) as string[];
    if (!Array.isArray(keys)) return;
    for (const k of keys.slice(-MAX_CACHE)) {
      const v = window.sessionStorage.getItem(STORAGE_PREFIX + k);
      if (v) cache.set(k, v);
    }
  } catch { /* corrupt → ignore */ }
}

function persistToSessionStorage(key: string, url: string) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, url);
    const raw = window.sessionStorage.getItem(STORAGE_INDEX_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    const idx = arr.indexOf(key);
    if (idx >= 0) arr.splice(idx, 1);
    arr.push(key);
    while (arr.length > STORAGE_MAX) {
      const drop = arr.shift();
      if (drop) window.sessionStorage.removeItem(STORAGE_PREFIX + drop);
    }
    window.sessionStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(arr));
  } catch { /* quota exceeded → silently skip */ }
}

export function buildBoringAvatarDataUrl(opts: {
  variant: BoringVariant;
  seed: string;
  colors: string[];
  size?: number;
  square?: boolean;
}): string {
  hydrateFromSessionStorage();
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
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, url);
  persistToSessionStorage(key, url);
  return url;
}

