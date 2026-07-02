import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('SEO programmatic guardrails', () => {
  const seoPageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/SeoPage.tsx'),
    'utf-8'
  );
  const searchPageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/SearchPage.tsx'),
    'utf-8'
  );
  const cityPageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/CityPage.tsx'),
    'utf-8'
  );
  const useProvidersSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/hooks/useProviders.tsx'),
    'utf-8'
  );
  const jobDetailPageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/JobDetailPage.tsx'),
    'utf-8'
  );
  const popularServicePageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/PopularServicePage.tsx'),
    'utf-8'
  );

  const sitemapSource = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase/functions/sitemap/index.ts'),
    'utf-8'
  );

  it('marks empty or invalid SEO pages as noindex', () => {
    expect(seoPageSource).toContain('const shouldNoindex = isNotFound || providers.length === 0;');
    expect(seoPageSource).toContain('noindex: shouldNoindex');
  });

  it('does not fabricate city slugs outside the known city list', () => {
    expect(seoPageSource).not.toContain("const city = rest.split('-')");
    expect(seoPageSource).toContain("if (!slug.startsWith(`${catSlug}-`)) continue;");
  });

  it('resolves legacy category and city slugs through aliases before returning not found', () => {
    expect(seoPageSource).toContain("resolveCityBySlug(slug)");
    expect(seoPageSource).toContain("resolveCategoryBySlug(parsed.categorySlug)");
    expect(cityPageSource).toContain("from('city_slug_aliases' as any)");
    expect(useProvidersSource).toContain("from('category_slug_aliases' as any)");
  });

  it('limits sitemap SEO landings to combinations backed by approved providers', () => {
    expect(sitemapSource).toContain('const seoLandingPaths = new Set<string>();');
    expect(sitemapSource).toContain('for (const provider of providers || [])');
  });

  it('keeps internal search results out of indexation', () => {
    expect(searchPageSource).toContain('noindex: true');
  });

  it('links city pages only to covered categories', () => {
    expect(cityPageSource).toContain('const coveredCategories = useMemo(() => {');
    expect(cityPageSource).not.toContain('allCategories.map((cat) => (');
  });

  it('keeps commercial pages from indexing empty inventories', () => {
    expect(popularServicePageSource).toContain('const shouldNoindex = !!service && providers.length === 0 && !provsLoading;');
    expect(popularServicePageSource).toContain('noindex: shouldNoindex');
  });

  it('consolidates job detail pages to canonical slugs', () => {
    expect(jobDetailPageSource).toContain('const canonicalJobUrl = job ?');
    expect(jobDetailPageSource).toContain("navigate(`/vaga/${job.slug}`, { replace: true });");
  });
});
