/**
 * Valida que `buildCanonicalUrl` é o único helper de canonical compartilhado
 * entre todas as páginas e SEMPRE devolve URL absoluta — inclusive quando a
 * variável de ambiente SITE_BASE_URL não está definida.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildCanonicalUrl, getSiteBaseUrl, CANONICAL_FALLBACK_BASE } from '@/lib/canonicalUrl';

describe('canonicalUrl helper compartilhado', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.SITE_BASE_URL;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.SITE_BASE_URL;
    else process.env.SITE_BASE_URL = originalEnv;
  });

  it('retorna URL absoluta mesmo sem SITE_BASE_URL definido', () => {
    delete process.env.SITE_BASE_URL;
    const url = buildCanonicalUrl('/categoria/eletricista');
    expect(url).toMatch(/^https:\/\//);
    expect(url.endsWith('/categoria/eletricista')).toBe(true);
  });

  it('usa o fallback de produção quando env não existe', () => {
    delete process.env.SITE_BASE_URL;
    expect(getSiteBaseUrl()).toBe(CANONICAL_FALLBACK_BASE);
  });

  it('respeita SITE_BASE_URL customizado e remove trailing slash', () => {
    process.env.SITE_BASE_URL = 'https://staging.example.com/';
    expect(getSiteBaseUrl()).toBe('https://staging.example.com');
    expect(buildCanonicalUrl('/x')).toBe('https://staging.example.com/x');
  });

  it('normaliza barras duplicadas e trailing slash do path', () => {
    delete process.env.SITE_BASE_URL;
    expect(buildCanonicalUrl('//cidades///sp//sao-paulo/')).toBe(
      `${CANONICAL_FALLBACK_BASE}/cidades/sp/sao-paulo`,
    );
  });

  it('preserva URL absoluta no mesmo domínio sem reescrever host', () => {
    delete process.env.SITE_BASE_URL;
    const url = buildCanonicalUrl(`${CANONICAL_FALLBACK_BASE}/categoria/pintor`);
    expect(url).toBe(`${CANONICAL_FALLBACK_BASE}/categoria/pintor`);
  });

  it('preserva domínio externo (não reescreve)', () => {
    const url = buildCanonicalUrl('https://outro-site.com/abc');
    expect(url).toBe('https://outro-site.com/abc');
  });

  it('aceita protocolo ausente em SITE_BASE_URL', () => {
    process.env.SITE_BASE_URL = 'meudominio.com';
    expect(getSiteBaseUrl()).toBe('https://meudominio.com');
  });

  it('Breadcrumbs e useSeoHead consomem o MESMO helper (single source)', async () => {
    const breadcrumbsSrc = await import('fs').then((fs) =>
      fs.readFileSync('src/components/Breadcrumbs.tsx', 'utf8'),
    );
    const seoHeadSrc = await import('fs').then((fs) =>
      fs.readFileSync('src/hooks/useSeoHead.ts', 'utf8'),
    );
    expect(breadcrumbsSrc).toMatch(/from ['"]@\/lib\/canonicalUrl['"]/);
    expect(seoHeadSrc).toMatch(/from ['"]@\/lib\/canonicalUrl['"]/);
  });
});
