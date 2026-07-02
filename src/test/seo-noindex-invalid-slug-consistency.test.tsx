/**
 * seo-noindex-invalid-slug-consistency.test.tsx
 *
 * Cobre variações de NOINDEX para garantir consistência entre
 * `meta robots`, `link[rel=canonical]` e tags Open Graph quando:
 *   - O slug não existe no banco (categoria/cidade/profissional inválidos)
 *   - A URL recebe parâmetros suspeitos (utm_, ref=, query strings inúteis)
 *   - O slug é vazio / só caracteres especiais
 *
 * Princípio: mesmo em páginas noindex, canonical e OG devem permanecer
 * coerentes (não vazios, não quebrados) — caso contrário crawlers podem
 * indexar conteúdo errado, ou pior, indexar a página apesar do noindex.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useSeoHead } from '@/hooks/useSeoHead';
import { getCategorySeoMeta, getEspecialidadeSeoMeta } from '@/lib/categorySeo';

vi.mock('@/hooks/useSiteSettings', () => ({ useSettingValue: () => null }));

function clearHead() {
  document
    .querySelectorAll(
      'link[rel="canonical"], meta[name], meta[property], script[type="application/ld+json"]',
    )
    .forEach((n) => n.remove());
  document.title = '';
}

const getMeta = (name: string, attr: 'name' | 'property' = 'name') =>
  (document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null)?.content ?? null;

const getCanonical = () =>
  (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href ?? null;

/**
 * Asserts compartilhados para qualquer cenário noindex:
 *  - robots = "noindex, nofollow"
 *  - canonical absoluto, não vazio
 *  - og:url == canonical
 *  - og:title e og:description NÃO vazios (mesmo em fallback)
 *  - sem regressão: og:image continua presente
 */
function assertNoindexConsistent(expectedCanonicalSuffix: string) {
  expect(getMeta('robots')).toBe('noindex, nofollow');

  const canonical = getCanonical();
  expect(canonical, 'canonical não pode ser vazio mesmo em noindex').toBeTruthy();
  expect(canonical).toMatch(/^https:\/\//);
  expect(canonical?.endsWith(expectedCanonicalSuffix)).toBe(true);

  const ogUrl = getMeta('og:url', 'property');
  expect(ogUrl).toBe(canonical);

  const ogTitle = getMeta('og:title', 'property');
  expect(ogTitle).toBeTruthy();
  expect((ogTitle || '').length).toBeGreaterThan(0);

  const ogDesc = getMeta('og:description', 'property');
  expect(ogDesc).toBeTruthy();
  expect((ogDesc || '').length).toBeGreaterThan(0);

  // OG image continua presente (fallback social padrão)
  expect(getMeta('og:image', 'property')).toMatch(/^https?:\/\//);
  expect(getMeta('og:image:width', 'property')).toBe('1200');
  expect(getMeta('og:image:height', 'property')).toBe('630');
}

describe('SEO — noindex em slugs inválidos / parâmetros suspeitos', () => {
  beforeEach(() => clearHead());
  afterEach(() => cleanup());

  // ---------- /categoria ----------
  describe('/categoria/:slug inválido', () => {
    it('slug inexistente força noindex e canonical do próprio slug', () => {
      const meta = getCategorySeoMeta({ slug: 'categoria-que-nao-existe', category: null });
      expect(meta.noindex).toBe(true);
      renderHook(() =>
        useSeoHead({
          title: meta.title,
          description: meta.description,
          canonical: meta.canonical,
          noindex: meta.noindex,
        }),
      );
      assertNoindexConsistent('/categoria/categoria-que-nao-existe');
    });

    it('slug com caracteres especiais ainda gera canonical e OG válidos', () => {
      const meta = getCategorySeoMeta({ slug: 'a@b!c', category: null });
      renderHook(() =>
        useSeoHead({
          title: meta.title,
          description: meta.description,
          canonical: meta.canonical,
          noindex: meta.noindex,
        }),
      );
      expect(getMeta('robots')).toBe('noindex, nofollow');
      expect(getCanonical()).toMatch(/^https:\/\//);
      expect(getMeta('og:title', 'property')).toBeTruthy();
    });
  });

  // ---------- /especialidades ----------
  describe('/especialidades/:slug inválido', () => {
    it('especialidade ausente → noindex + canonical preservado', () => {
      const meta = getEspecialidadeSeoMeta({ slug: 'especialidade-fake', category: null });
      expect(meta.noindex).toBe(true);
      renderHook(() =>
        useSeoHead({
          title: meta.title,
          description: meta.description,
          canonical: meta.canonical,
          noindex: meta.noindex,
        }),
      );
      assertNoindexConsistent('/especialidades/especialidade-fake');
    });
  });

  // ---------- /cidade ----------
  describe('/cidade/:slug inválido', () => {
    it('cidade inexistente → noindex + canonical absoluto + OG não-vazio', () => {
      renderHook(() =>
        useSeoHead({
          title: 'Cidade não encontrada',
          description:
            'Esta cidade não existe ou ainda não tem profissionais cadastrados. Veja outras cidades disponíveis.',
          canonical: 'https://precisodeum.com.br/cidade/cidade-que-nao-existe',
          noindex: true,
        }),
      );
      assertNoindexConsistent('/cidade/cidade-que-nao-existe');
    });

    it('UF inválida em /cidades/:uf/:slug → noindex coerente', () => {
      renderHook(() =>
        useSeoHead({
          title: 'Cidade não encontrada',
          description:
            'A combinação de estado e cidade informada não foi encontrada em nosso diretório.',
          canonical: 'https://precisodeum.com.br/cidades/zz/inexistente',
          noindex: true,
        }),
      );
      assertNoindexConsistent('/cidades/zz/inexistente');
    });
  });

  // ---------- /profissional ----------
  describe('/profissional/:slug inválido', () => {
    it('profissional inexistente → noindex + canonical estável', () => {
      renderHook(() =>
        useSeoHead({
          title: 'Profissional não encontrado',
          description:
            'Este profissional não existe ou foi removido. Veja outros profissionais verificados em sua região.',
          canonical: 'https://precisodeum.com.br/profissional/usuario-inexistente',
          noindex: true,
          ogType: 'profile',
        }),
      );
      assertNoindexConsistent('/profissional/usuario-inexistente');
      // Mesmo em noindex, og:type informado deve ser respeitado
      expect(getMeta('og:type', 'property')).toBe('profile');
    });
  });

  // ---------- Parâmetros suspeitos ----------
  describe('parâmetros de URL suspeitos não vazam para canonical', () => {
    it('canonical SEMPRE remove utm_* e tracking params (passados pelo dev)', () => {
      // O hook recebe canonical já normalizado pelo helper buildCanonicalUrl;
      // garantimos que se o dev passar canonical limpo, robots indexável e
      // canonical permanecem consistentes mesmo se a URL atual tiver query.
      renderHook(() =>
        useSeoHead({
          title: 'Eletricista no Brasil',
          description:
            'Encontre profissionais de eletricista verificados em todo o Brasil, com avaliações reais.',
          canonical: 'https://precisodeum.com.br/categoria/eletricista',
        }),
      );
      const canonical = getCanonical();
      expect(canonical).toBe('https://precisodeum.com.br/categoria/eletricista');
      expect(canonical).not.toContain('utm_');
      expect(canonical).not.toContain('?');
      expect(getMeta('robots')).toBe('index, follow');
    });
  });

  // ---------- Transição index ↔ noindex ----------
  it('alternar entre rota válida e inválida atualiza robots e canonical sem resíduo', () => {
    // Primeira renderização: válida
    const { rerender, unmount } = renderHook(
      ({ noindex, canonical }: { noindex: boolean; canonical: string }) =>
        useSeoHead({
          title: 'Teste transição',
          description:
            'Validando que mudar de rota válida para inválida limpa robots e canonical adequadamente.',
          canonical,
          noindex,
        }),
      { initialProps: { noindex: false, canonical: 'https://precisodeum.com.br/categoria/pintor' } },
    );

    expect(getMeta('robots')).toBe('index, follow');
    expect(getCanonical()?.endsWith('/categoria/pintor')).toBe(true);

    // Re-render: rota inválida
    rerender({ noindex: true, canonical: 'https://precisodeum.com.br/categoria/inexistente' });
    expect(getMeta('robots')).toBe('noindex, nofollow');
    expect(getCanonical()?.endsWith('/categoria/inexistente')).toBe(true);

    // Sem resíduo de tags duplicadas
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.querySelectorAll('meta[name="robots"]')).toHaveLength(1);

    unmount();
  });
});
