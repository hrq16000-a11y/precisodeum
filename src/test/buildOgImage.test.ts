/**
 * Testes para o helper buildOgImage (compartilhado com a edge og-profile).
 * Validamos a seleção de ratio por User-Agent e a geração de URLs do
 * Storage Image Transforms — sem rede.
 */
import { describe, it, expect } from 'vitest';
import {
  buildOgImage,
  pickOgRatio,
  OG_IMAGE_SPECS,
} from '../../supabase/functions/og-profile/buildOgImage';

const STORAGE = 'https://qaftogrqeyymewoofexc.supabase.co';
const SAMPLE = `${STORAGE}/storage/v1/object/public/avatars/abc/123.webp`;

describe('pickOgRatio', () => {
  it('returns "square" for WhatsApp (1:1 preview crawler)', () => {
    expect(pickOgRatio('WhatsApp/2.23.20.0 A')).toBe('square');
  });

  it('returns "square" for LinkedIn / Telegram / Discord / Slack', () => {
    expect(pickOgRatio('LinkedInBot/1.0')).toBe('square');
    expect(pickOgRatio('TelegramBot (like TwitterBot)')).toBe('square');
    expect(pickOgRatio('Mozilla/5.0 (compatible; Discordbot/2.0)')).toBe('square');
    expect(pickOgRatio('Slackbot-LinkExpanding 1.0')).toBe('square');
  });

  it('returns "wide" for Facebook / Twitter (landscape preview)', () => {
    expect(pickOgRatio('facebookexternalhit/1.1')).toBe('wide');
    expect(pickOgRatio('Twitterbot/1.0')).toBe('wide');
  });

  it('falls back to "wide" for unknown / empty UA', () => {
    expect(pickOgRatio(null)).toBe('wide');
    expect(pickOgRatio('')).toBe('wide');
    expect(pickOgRatio('Mozilla/5.0 (random browser)')).toBe('wide');
  });

  it('is case-insensitive', () => {
    expect(pickOgRatio('WHATSAPP/2.0')).toBe('square');
    expect(pickOgRatio('whatsapp/2.0')).toBe('square');
  });
});

describe('buildOgImage', () => {
  it('returns empty string for empty input', () => {
    expect(buildOgImage('', 'wide')).toBe('');
    expect(buildOgImage(null, 'wide')).toBe('');
    expect(buildOgImage(undefined, 'square')).toBe('');
  });

  it('applies Storage transform with 1200x630 for ratio=wide', () => {
    const out = buildOgImage(SAMPLE, 'wide');
    expect(out).toContain('/storage/v1/render/image/public/avatars/abc/123.webp');
    expect(out).toContain(`width=${OG_IMAGE_SPECS.wide.width}`);
    expect(out).toContain(`height=${OG_IMAGE_SPECS.wide.height}`);
    expect(out).toContain('resize=cover');
    expect(out).toContain('quality=82');
  });

  it('applies Storage transform with 1080x1080 for ratio=square', () => {
    const out = buildOgImage(SAMPLE, 'square');
    expect(out).toContain('width=1080');
    expect(out).toContain('height=1080');
    expect(out).toContain('resize=cover');
  });

  it('strips existing query params before appending new ones', () => {
    const dirty = `${SAMPLE}?width=320&quality=70`;
    const out = buildOgImage(dirty, 'wide');
    // Não pode ter o width antigo
    const widthMatches = out.match(/width=/g) || [];
    expect(widthMatches.length).toBe(1);
    expect(out).toContain('width=1200');
  });

  it('returns external URLs unchanged (Google avatars, etc.)', () => {
    const ext = 'https://lh3.googleusercontent.com/a/abc=s96-c';
    expect(buildOgImage(ext, 'wide')).toBe(ext);
    expect(buildOgImage(ext, 'square')).toBe(ext);
  });

  it('returns invalid URLs unchanged', () => {
    expect(buildOgImage('not-a-url', 'wide')).toBe('not-a-url');
  });

  it('handles render/image source paths (already transformed) by stripping query', () => {
    const already = `${STORAGE}/storage/v1/render/image/public/avatars/abc/123.webp?width=99`;
    const out = buildOgImage(already, 'wide');
    expect(out).toContain('width=1200');
    expect((out.match(/width=/g) || []).length).toBe(1);
  });
});
