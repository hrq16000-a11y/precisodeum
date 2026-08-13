import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BRAND, BRAND_BASE_URL, withBrandTitle, brandSameAs } from '@/config/brand';
import { SITE_BASE_URL } from '@/lib/siteAssets';
import { buildCanonicalUrl, CANONICAL_FALLBACK_BASE } from '@/lib/canonicalUrl';
import { resolveSponsorSlots, SPONSOR_PAGE_KINDS } from '@/config/sponsorSlots';
import { POSITION_CONFIG } from '@/config/sponsorPositions';
import { isFeatureEnabled, isGuideMode, setGuideModeOverride } from '@/config/guideMode';

describe('brand config — fonte única de marca/domínio/nicho', () => {
  it('expõe marca, domínio e nicho coerentes', () => {
    expect(BRAND.name).toBeTruthy();
    expect(BRAND_BASE_URL).toMatch(/^https:\/\//);
    expect(BRAND_BASE_URL.endsWith('/')).toBe(false);
    expect(BRAND.domain).toBe(new URL(BRAND_BASE_URL).host);
    expect(BRAND.niche.professionalNounPlural).toBeTruthy();
  });

  it('helpers de SEO derivam do brand config', () => {
    expect(SITE_BASE_URL).toBe(BRAND_BASE_URL);
    expect(CANONICAL_FALLBACK_BASE).toBe(BRAND_BASE_URL);
    expect(buildCanonicalUrl('/categoria/eletricista')).toBe(
      `${BRAND_BASE_URL}/categoria/eletricista`,
    );
  });

  it('não duplica o sufixo de marca no title', () => {
    expect(withBrandTitle('Eletricista em Curitiba')).toContain(BRAND.name);
    expect(withBrandTitle(`Algo | ${BRAND.name}`)).toBe(`Algo | ${BRAND.name}`);
    expect(brandSameAs().every((u) => typeof u === 'string')).toBe(true);
  });

  it('helpers centrais não hardcodam mais o domínio', () => {
    for (const file of ['src/lib/siteAssets.ts', 'src/lib/categorySeo.ts', 'src/lib/canonicalUrl.ts']) {
      const src = readFileSync(file, 'utf8');
      const codeLines = src
        .split('\n')
        .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
      expect(codeLines.join('\n')).not.toContain("'https://precisodeum.com.br'");
    }
  });
});

describe('sponsor slots declarativos', () => {
  it('todas as posições referenciadas existem em POSITION_CONFIG', () => {
    for (const page of SPONSOR_PAGE_KINDS) {
      for (const slot of resolveSponsorSlots(page)) {
        expect(POSITION_CONFIG[slot.position]).toBeDefined();
        expect(slot.maxItems).toBeGreaterThan(0);
      }
    }
  });

  it('retorna slots ordenados e sem duplicatas', () => {
    const slots = resolveSponsorSlots('category_city');
    const orders = slots.map((s) => s.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(new Set(slots.map((s) => s.position)).size).toBe(slots.length);
  });

  it('cidade desconhecida não altera os slots base', () => {
    expect(resolveSponsorSlots('city', { citySlug: 'cidade-inexistente' })).toEqual(
      resolveSponsorSlots('city'),
    );
  });
});

describe('modo guia comercial', () => {
  it('desligado por padrão — nenhum recurso é ocultado', () => {
    setGuideModeOverride(null);
    expect(isGuideMode()).toBe(false);
    expect(isFeatureEnabled('chat')).toBe(true);
    expect(isFeatureEnabled('provider_dashboard')).toBe(true);
  });

  it('quando ativo, mantém catálogo/conteúdo/lead e desliga o resto', () => {
    setGuideModeOverride(true);
    expect(isFeatureEnabled('catalog')).toBe(true);
    expect(isFeatureEnabled('lead_form')).toBe(true);
    expect(isFeatureEnabled('sponsors')).toBe(true);
    expect(isFeatureEnabled('chat')).toBe(false);
    expect(isFeatureEnabled('gamification')).toBe(false);
    setGuideModeOverride(null);
  });
});
