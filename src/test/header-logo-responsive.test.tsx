/**
 * Header + Logo · responsividade, skeleton, fallback e diagnóstico de flicker.
 *
 * Trava:
 *  - skeleton (shimmer) enquanto o logo carrega, com espaço reservado (sem CLS);
 *  - fallback SVG embutido quando a imagem e o fallback de marca falham;
 *  - contêiner do logo no Header não encolhe (shrink-0 / sem overflow-hidden);
 *  - logo permanece legível nos breakpoints mobile comuns;
 *  - diagnóstico classifica a causa do flicker.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import Logo from '@/components/Logo';
import {
  clearHeaderFlickerEvents,
  getHeaderFlickerEvents,
  logHeaderFlicker,
} from '@/lib/headerFlickerDiagnostics';

const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

const setViewport = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
};

const renderLogo = (props = {}) =>
  render(
    <MemoryRouter>
      <Logo {...props} />
    </MemoryRouter>,
  );

describe('Logo · skeleton e fallback', () => {
  beforeEach(() => {
    cleanup();
    clearHeaderFlickerEvents();
  });

  it('mostra skeleton shimmer com espaço reservado antes do load', () => {
    const { container } = renderLogo({ priority: true });
    const wrapper = container.querySelector('[data-logo-state]') as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.getAttribute('data-logo-state')).toBe('loading');
    expect(wrapper.className).toContain('skeleton-shimmer');
    // espaço reservado → sem layout shift quando a imagem chega
    expect(wrapper.className).toMatch(/aspect-\[111\/40\]/);
    expect(wrapper.className).toContain('h-14');
  });

  it('remove o skeleton após o load da imagem', () => {
    const { container } = renderLogo({ priority: true });
    const img = container.querySelector('img') as HTMLImageElement;
    fireEvent.load(img);
    const wrapper = container.querySelector('[data-logo-state]') as HTMLElement;
    expect(wrapper.getAttribute('data-logo-state')).toBe('loaded');
    expect(wrapper.className).not.toContain('skeleton-shimmer');
  });

  it('cai para SVG embutido quando imagem e fallback de marca falham', () => {
    const { container } = renderLogo({ priority: true });
    const img = container.querySelector('img') as HTMLImageElement;
    fireEvent.error(img); // 1ª falha → tenta fallback de marca
    fireEvent.error(container.querySelector('img') as HTMLImageElement); // 2ª falha → SVG
    const svg = container.querySelector('svg[data-logo-fallback="true"]');
    expect(svg, 'fallback SVG ausente').toBeTruthy();
    expect(svg!.getAttribute('aria-label')).toBe('Preciso de um Profissional');
  });

  it('mantém o logo legível nos breakpoints mobile comuns', () => {
    for (const w of [320, 360, 375, 390, 414, 768]) {
      cleanup();
      setViewport(w);
      const { container } = renderLogo({ priority: true });
      const img = container.querySelector('img') as HTMLImageElement;
      expect(img, `logo ausente em ${w}px`).toBeTruthy();
      expect(img.className, `logo sem altura mínima em ${w}px`).toContain('min-h-14');
      expect(img.getAttribute('sizes'), `sizes ausente em ${w}px`).toBeTruthy();
    }
  });
});

describe('Header · contêiner da logo', () => {
  const header = read('src/components/Header.tsx');

  it('bloco da logo não encolhe nem corta por overflow', () => {
    const block = header.slice(header.indexOf('{/* Left: Logo + Geo */}'));
    const divLine = block.slice(0, block.indexOf('<Logo'));
    expect(divLine).toContain('shrink-0');
    expect(divLine).not.toContain('overflow-hidden');
  });
});

describe('Diagnóstico de flicker do header', () => {
  beforeEach(() => clearHeaderFlickerEvents());

  it('classifica as causas conhecidas', () => {
    logHeaderFlicker('no_intersection_observer');
    logHeaderFlicker('header_height_change', { from: 56, to: 48 });
    logHeaderFlicker('layout_shift', { value: 0.04 });
    const reasons = getHeaderFlickerEvents().map((e) => e.reason);
    expect(reasons).toEqual(['no_intersection_observer', 'header_height_change', 'layout_shift']);
    expect(getHeaderFlickerEvents()[1].detail).toMatchObject({ from: 56, to: 48 });
  });
});
