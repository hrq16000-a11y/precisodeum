/**
 * Varredura de breakpoints — estabilidade de layout (CLS) dos slots de
 * patrocinador e dos cards de profissional nas rotas /categoria, /cidade e
 * /profissional.
 *
 * Estratégia:
 *  1. Contrato estático: componentes de mídia precisam reservar espaço
 *     (aspect-*, min-h-*, h-*) e nunca estourar o container (max-w-full).
 *  2. Render em múltiplos viewports: a matriz de slots e um card renderizam
 *     sem overflow horizontal declarado e mantêm a mesma contagem de nós.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GuideSlotMatrix } from '@/components/seo/GuideSlotMatrix';
import { POSITION_KEYS } from '@/config/sponsorPositions';
import { resolveSponsorSlots } from '@/config/sponsorSlots';

const BREAKPOINTS = [
  { name: 'mobile', width: 360 },
  { name: 'mobile-lg', width: 414 },
  { name: 'tablet', width: 768 },
  { name: 'tablet-lg', width: 1024 },
  { name: 'desktop', width: 1280 },
  { name: 'desktop-xl', width: 1536 },
];

/** Componentes visuais presentes nas rotas SEO monitoradas. */
const LAYOUT_CRITICAL_FILES = [
  'src/components/ProviderCard.tsx',
  'src/components/sponsors/SponsorTopBanner.tsx',
  'src/components/sponsors/SponsorPremiumCard.tsx',
  'src/components/sponsors/SponsorMidContent.tsx',
  'src/components/sponsors/SponsorSidebarWidget.tsx',
  'src/components/seo/GuideSlotMatrix.tsx',
].filter((f) => existsSync(f));

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
  window.dispatchEvent(new Event('resize'));
}

describe('breakpoints — contrato estático de layout', () => {
  it('monitora um conjunto não vazio de componentes', () => {
    expect(LAYOUT_CRITICAL_FILES.length).toBeGreaterThanOrEqual(3);
  });

  it.each(LAYOUT_CRITICAL_FILES)('%s reserva espaço para mídia (sem CLS)', (file) => {
    const src = readFileSync(file, 'utf8');
    const hasImage = /<img|LazyImage|background-image/.test(src);
    if (!hasImage) return;
    const reservesSpace = /aspect-|min-h-|\bh-\d|h-\[|height:/.test(src);
    expect(reservesSpace, `${file} usa imagem sem reservar altura/aspect`).toBe(true);
  });

  it.each(LAYOUT_CRITICAL_FILES)('%s não usa largura fixa em px que quebre no mobile', (file) => {
    const src = readFileSync(file, 'utf8');
    const fixedWidths = [...src.matchAll(/\bw-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    const tooWide = fixedWidths.filter((w) => w > 360);
    expect(tooWide, `${file} tem largura fixa maior que o menor viewport`).toEqual([]);
  });

  it.each(LAYOUT_CRITICAL_FILES)('%s carrega imagens de forma lazy quando aplicável', (file) => {
    const src = readFileSync(file, 'utf8');
    if (!/<img/.test(src)) return;
    expect(/loading=["']lazy["']|LazyImage|loading={/.test(src)).toBe(true);
  });
});

describe('breakpoints — render da matriz de slots', () => {
  beforeEach(() => cleanup());

  it.each(BREAKPOINTS)('renderiza estável em $name ($width px)', ({ width }) => {
    setViewport(width);
    const { container, unmount } = render(
      <MemoryRouter>
        <GuideSlotMatrix cities={['curitiba', 'pinhais']} />
      </MemoryRouter>,
    );

    const matrix = container.querySelector('[data-testid="guide-slot-matrix"]');
    expect(matrix).toBeTruthy();

    // Toda posição existe em todas as larguras — sem sumir por breakpoint.
    for (const position of POSITION_KEYS) {
      expect(container.querySelector(`[data-testid="slot-cell-curitiba-${position}"]`)).toBeTruthy();
    }

    // Contêiner rolável horizontal em vez de estourar o layout.
    const table = container.querySelector('table');
    expect(table?.parentElement?.className).toMatch(/overflow-x-auto/);
    expect(matrix?.className ?? '').not.toMatch(/\bw-\[\d{4,}px\]/);

    unmount();
  });

  it('slots ativos refletem a configuração real por cidade em qualquer viewport', () => {
    const expected = resolveSponsorSlots('category_city', {
      citySlug: 'curitiba',
      guideMode: true,
    }).map((s) => s.position);

    for (const { width } of BREAKPOINTS) {
      setViewport(width);
      const { container, unmount } = render(
        <MemoryRouter>
          <GuideSlotMatrix cities={['curitiba']} />
        </MemoryRouter>,
      );
      const active = POSITION_KEYS.filter(
        (p) =>
          container
            .querySelector(`[data-testid="slot-cell-curitiba-${p}"]`)
            ?.getAttribute('data-active') === 'true',
      );
      expect(active.sort()).toEqual([...expected].sort());
      unmount();
    }
  });
});
