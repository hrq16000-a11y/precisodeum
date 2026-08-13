import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BRAND, BRAND_BASE_URL } from '@/config/brand';
import {
  buildBreadcrumbList,
  buildFaqPage,
  buildOrganization,
} from '@/lib/seo-schemas';
import { auditJsonLd, auditRoutesJsonLd } from '@/lib/seo/jsonLdBrandAudit';
import {
  buildGuideRobotsTxt,
  buildGuideSitemap,
  classifyGuidePath,
  guideCanonical,
} from '@/lib/seo/guideSitemap';
import { isFeatureEnabled, setGuideModeOverride, type GuideFeature } from '@/config/guideMode';
import { resolveSponsorSlots, SPONSOR_PAGE_KINDS, type SponsorPageKind } from '@/config/sponsorSlots';
import { POSITION_CONFIG } from '@/config/sponsorPositions';

afterEach(() => {
  setGuideModeOverride(null);
  cleanup();
});

// ---------------------------------------------------------------- JSON-LD

describe('JSON-LD × brand config — consistência por rota SEO', () => {
  const routes = [
    {
      path: '/categoria/eletricista',
      payloads: [
        buildBreadcrumbList([
          { name: 'Início', url: `${BRAND_BASE_URL}/` },
          { name: 'Categorias', url: `${BRAND_BASE_URL}/categorias` },
          { name: 'Eletricista' },
        ]),
        buildFaqPage([{ question: 'Quanto custa?', answer: 'Depende do serviço.' }]),
      ],
    },
    {
      path: '/cidade/curitiba',
      payloads: [
        buildBreadcrumbList([
          { name: 'Início', url: `${BRAND_BASE_URL}/` },
          { name: 'Curitiba', url: `${BRAND_BASE_URL}/cidade/curitiba` },
        ]),
      ],
    },
    {
      path: '/profissional/joao-eletricista',
      payloads: [
        buildBreadcrumbList([
          { name: 'Início', url: `${BRAND_BASE_URL}/` },
          { name: 'João Eletricista' },
        ]),
      ],
    },
    {
      path: '/',
      payloads: [buildOrganization({ name: BRAND.name, url: BRAND_BASE_URL })],
    },
  ];

  it('todas as rotas emitem JSON-LD válido e ancorado no domínio da marca', () => {
    const { ok, reports } = auditRoutesJsonLd(routes);
    const errors = reports.flatMap((r) =>
      r.issues.filter((i) => i.severity === 'error').map((i) => `${r.path}: ${i.message}`),
    );
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('detecta domínio estrangeiro e URL relativa', () => {
    const foreign = auditJsonLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [{ '@type': 'ListItem', position: 1, name: 'X', item: 'https://outro-site.com/x' }],
    });
    expect(foreign.issues.some((i) => i.code === 'foreign_domain')).toBe(true);

    const relative = auditJsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: BRAND.name,
      url: '/relativo',
    });
    expect(relative.ok).toBe(false);
    expect(relative.issues.some((i) => i.code === 'relative_url')).toBe(true);
  });

  it('reprova nome fora do brand config e payload vazio', () => {
    const mismatch = auditJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Outra Marca',
      url: BRAND_BASE_URL,
    });
    expect(mismatch.ok).toBe(false);
    expect(auditJsonLd(null).issues[0].code).toBe('empty_payload');
  });
});

// ------------------------------------------------------- Sitemap / robots

describe('sitemap e robots no modo guia', () => {
  const entries = [
    { path: '/categoria/eletricista', feature: 'catalog' as GuideFeature },
    { path: '/cidade/curitiba/', feature: 'catalog' as GuideFeature },
    { path: '/ajuda', feature: 'content_pages' as GuideFeature },
    { path: '/blog/como-contratar', feature: 'blog' as GuideFeature },
    { path: '/vagas', feature: 'jobs' as GuideFeature },
    { path: '/cursos', feature: 'courses' as GuideFeature },
    { path: '/dashboard/perfil', feature: 'provider_dashboard' as GuideFeature },
    { path: '/categoria/thin/em/vazio', feature: 'catalog' as GuideFeature, noindex: true },
  ];

  it('portal completo: só remove o que é noindex', () => {
    setGuideModeOverride(null);
    const result = buildGuideSitemap(entries);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].reason).toBe('noindex');
    expect(result.urls.every((u) => u.startsWith(BRAND_BASE_URL))).toBe(true);
  });

  it('modo guia: remove vagas/cursos/dashboard e mantém catálogo, conteúdo e blog', () => {
    setGuideModeOverride(true);
    const { included, excluded } = buildGuideSitemap(entries);
    const paths = included.map((e) => e.path);
    expect(paths).toContain('/categoria/eletricista');
    expect(paths).toContain('/cidade/curitiba'); // trailing slash normalizado
    expect(paths).toContain('/ajuda');
    expect(paths).toContain('/blog/como-contratar');
    const disabled = excluded.filter((e) => e.reason === 'feature_disabled').map((e) => e.path);
    expect(disabled).toEqual(expect.arrayContaining(['/vagas', '/cursos', '/dashboard/perfil']));
  });

  it('robots do modo guia bloqueia recursos desligados e o preview', () => {
    setGuideModeOverride(true);
    const robots = buildGuideRobotsTxt();
    expect(robots).toContain('Disallow: /vagas/');
    expect(robots).toContain('Disallow: /cursos/');
    expect(robots).toContain('Disallow: /preview/');
    expect(robots).not.toContain('Disallow: /categoria/');
    expect(robots).toContain(`Sitemap: ${BRAND_BASE_URL}/sitemap.xml`);
  });

  it('classifica paths e monta canônico a partir do brand config', () => {
    expect(classifyGuidePath('/categoria/eletricista/em/curitiba')).toBe('catalog');
    expect(classifyGuidePath('/blog/post')).toBe('blog');
    expect(classifyGuidePath('/dashboard/leads')).toBe('provider_dashboard');
    expect(guideCanonical('/Categoria/Eletricista/')).toBe(`${BRAND_BASE_URL}/categoria/eletricista`);
  });

  it('robots.txt público bloqueia a rota de preview', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('public/robots.txt', 'utf8')).toContain('Disallow: /preview/');
  });
});

// ------------------------------------------------- Slots de patrocinador

/** Render mínimo do contrato de slots — mesma marcação usada em /preview/guia. */
function SlotStrip({ page, citySlug }: { page: SponsorPageKind; citySlug?: string }) {
  const slots = resolveSponsorSlots(page, { citySlug, guideMode: isFeatureEnabled('sponsors') });
  return (
    <div data-testid="slot-strip" className="w-full max-w-full overflow-x-clip">
      {slots.map((slot) => (
        <div
          key={slot.position}
          data-testid={`slot-${slot.position}`}
          data-order={String(slot.order)}
          data-max={String(slot.maxItems)}
          className="w-full max-w-full overflow-hidden"
        />
      ))}
    </div>
  );
}

describe('slots de patrocinador — posição correta e layout mobile', () => {
  it('cada página renderiza os slots declarativos na ordem definida', () => {
    for (const page of SPONSOR_PAGE_KINDS) {
      cleanup();
      const expected = resolveSponsorSlots(page);
      render(<SlotStrip page={page} />);
      const rendered = Array.from(
        screen.getByTestId('slot-strip').querySelectorAll('[data-testid^="slot-"]'),
      );
      expect(rendered).toHaveLength(expected.length);
      rendered.forEach((el, i) => {
        expect(el.getAttribute('data-testid')).toBe(`slot-${expected[i].position}`);
        expect(Number(el.getAttribute('data-order'))).toBe(expected[i].order);
        expect(Number(el.getAttribute('data-max'))).toBe(POSITION_CONFIG[expected[i].position].maxItems);
      });
    }
  });

  it('override por cidade não altera cidade não configurada', () => {
    render(<SlotStrip page="city" citySlug="cidade-sem-contrato" />);
    const rendered = screen.getByTestId('slot-strip').querySelectorAll('[data-testid^="slot-"]');
    expect(rendered).toHaveLength(resolveSponsorSlots('city').length);
  });

  it('não usa largura fixa que quebre o layout mobile', () => {
    render(<SlotStrip page="category_city" />);
    const strip = screen.getByTestId('slot-strip');
    expect(strip.className).toContain('max-w-full');
    strip.querySelectorAll('[data-testid^="slot-"]').forEach((el) => {
      expect(el.className).toContain('w-full');
      expect(el.className).not.toMatch(/\bw-\[\d+px\]/);
      expect(el.className).not.toMatch(/\bmin-w-\[\d{3,}px\]/);
    });
  });

  it('modo guia mantém os slots de patrocinador (monetização plugável)', () => {
    setGuideModeOverride(true);
    expect(isFeatureEnabled('sponsors')).toBe(true);
    expect(resolveSponsorSlots('category_city', { guideMode: true }).length).toBeGreaterThan(0);
  });
});
