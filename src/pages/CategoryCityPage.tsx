/**
 * CategoryCityPage — `/categoria/:slug/em/:cidade`
 *
 * Página SEO programática que combina categoria + cidade. Existe para:
 *  1. Indexar páginas long-tail ("eletricista em curitiba") com title/description
 *     próprios e canonical estável.
 *  2. Listar profissionais filtrados por categoria E cidade (string match
 *     normalizado) com link direto para o perfil.
 *  3. Linkar internamente para `/buscar?q=...&cidade=...` (busca com filtros)
 *     e para o perfil de cada profissional via `/profissional/:slug`.
 *
 * Comportamento de fallback (SEO seguro):
 *  - Slug inválido / categoria ausente → noindex.
 *  - Cidade não reconhecida (não está no índice de cidades) → noindex.
 *  - Sem resultados → renderiza CTA de busca ampliada (sem 404 hard).
 *
 * IMPORTANTE: Esta rota NÃO altera lógica de busca; apenas reusa
 * `useCategoryProviders` + filtragem cliente-side por cidade. Todo o ranking
 * vem do hook (mesmo do CategoryPage).
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, MapPin, Search, Users } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProviderCard from '@/components/ProviderCard';
import ProviderCardSkeleton from '@/components/ProviderCardSkeleton';
import EmptyStateFallback from '@/components/EmptyStateFallback';
import { Button } from '@/components/ui/button';

import { SeoMeta } from '@/components/SeoMeta';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useCategoryProviders } from '@/hooks/useProviders';
import { isKnownCity, preloadCitiesIndex } from '@/lib/citiesIndex';
import { normalize } from '@/lib/normalize';
import { buildCanonicalUrl } from '@/lib/canonicalUrl';
import { sanitizeSlug } from '@/lib/slugify';
import { importWithRetry } from '@/lib/lazyWithRetry';

// Fase 2.9 — runtime SEO enhancement (lazy, fora do critical path).
const SeoEnhancementSection = lazy(() =>
  importWithRetry(() => import('@/components/seo/SeoEnhancementSection')),
);

function humanizeSlug(slug: string | undefined): string {
  if (!slug) return '';
  return slug
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export default function CategoryCityPage() {
  const { slug, cidade } = useParams<{ slug: string; cidade: string }>();
  const { data: payload, isLoading } = useCategoryProviders(slug || '');
  const category = payload?.category;
  const allProviders = (payload?.providers || []) as any[];

  // FASE 2.1 — telemetria de visualização da landing categoria+cidade.
  useEffect(() => {
    if (!slug || !cidade) return;
    void import('@/lib/publicFunnelTelemetry').then(({ trackCategoryView }) =>
      trackCategoryView({ category: slug, city: cidade, source: 'category_city_page' })
    );
  }, [slug, cidade]);

  // PR 4: preload do dataset IBGE (chunk separado). `isKnownCity` é fail-open
  // até terminar, evitando esconder conteúdo durante o load.
  const [citiesLoaded, setCitiesLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void preloadCitiesIndex().then(() => { if (!cancelled) setCitiesLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const cityHuman = humanizeSlug(cidade);
  const categoryHuman = category?.name || humanizeSlug(slug);
  const cityKnown = useMemo(() => (cidade ? isKnownCity(cityHuman) : false), [cidade, cityHuman]);

  // Filtragem por cidade — match normalizado (acentos, case).
  const providers = useMemo(() => {
    if (!cidade) return [];
    const target = normalize(cityHuman);
    return allProviders.filter((p) => {
      const pc = normalize(p?.city || '');
      return pc === target;
    });
  }, [allProviders, cidade, cityHuman]);

  const valid = !!category && !!cidade && cityKnown;
  const title = valid
    ? `${categoryHuman} em ${cityHuman} — Profissionais Verificados | Preciso de Um`
    : 'Categoria ou cidade inválida | Preciso de Um';
  const description = valid
    ? `${providers.length} profissionais de ${categoryHuman.toLowerCase()} em ${cityHuman}. Avaliações reais e contato direto pelo WhatsApp. Encontre o ideal para o seu serviço.`
    : 'Esta combinação de categoria/cidade não está disponível. Veja outras opções no diretório.';

  const canonical = valid
    ? buildCanonicalUrl(`/categoria/${slug}/em/${cidade}`)
    : undefined;

  const seoNoindex = !valid || providers.length === 0;

  // JSON-LD ItemList apenas quando há resultados — evita lixo nos motores.
  useJsonLd(
    valid && providers.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `${categoryHuman} em ${cityHuman}`,
          numberOfItems: providers.length,
          itemListElement: providers.slice(0, 20).map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: buildCanonicalUrl(`/profissional/${p.slug || p.id}`),
            name: p.business_name || p.full_name || categoryHuman,
          })),
        }
      : null,
    `category-city-${slug}-${cidade}`,
  );

  const breadcrumbs = useMemo(
    () => [
      { label: 'Início', url: '/' },
      { label: 'Categorias', url: '/categorias' },
      ...(category
        ? [{ label: categoryHuman, url: `/categoria/${category.slug}` }]
        : []),
      ...(cityKnown ? [{ label: cityHuman, url: `/categoria/${slug}/em/${cidade}` }] : []),
    ],
    [category, categoryHuman, cityHuman, cityKnown, slug, cidade],
  );

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      data-seo-ready={!isLoading && !!category && cityKnown ? 'true' : undefined}
    >
      <SeoMeta title={title} description={description} canonical={canonical} noindex={seoNoindex} ogImage={DEFAULT_SOCIAL_IMAGE_URL} />
      <Header />

      <main className="flex-1 mx-auto w-full max-w-screen-xl px-4 py-6 space-y-6">
        <Breadcrumbs items={breadcrumbs} />

        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            {valid ? (
              <>
                {categoryHuman} em <span className="text-primary">{cityHuman}</span>
              </>
            ) : (
              'Categoria ou cidade não encontrada'
            )}
          </h1>
          {valid && (
            <p className="text-sm text-muted-foreground max-w-2xl">
              {providers.length > 0
                ? `${providers.length} ${providers.length === 1 ? 'profissional verificado' : 'profissionais verificados'} de ${categoryHuman.toLowerCase()} em ${cityHuman}.`
                : `Ainda não temos profissionais de ${categoryHuman.toLowerCase()} cadastrados em ${cityHuman}. Tente uma busca mais ampla.`}
            </p>
          )}
        </motion.header>

        {/* Atalhos de busca / cross-link interno (relevância SEO) */}
        {valid && (
          <nav
            aria-label="Atalhos de busca"
            className="flex flex-wrap gap-2 text-xs"
          >
            <Link
              to={`/buscar?q=${encodeURIComponent(categoryHuman)}&cidade=${encodeURIComponent(cityHuman)}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:bg-accent"
            >
              <Search className="h-3 w-3" /> Buscar {categoryHuman} em {cityHuman}
            </Link>
            <Link
              to={`/categoria/${category!.slug}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:bg-accent"
            >
              <ChevronRight className="h-3 w-3" /> Ver todos os {categoryHuman}
            </Link>
            <Link
              to={`/cidades/${(cidade || '').toLowerCase()}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:bg-accent"
            >
              <MapPin className="h-3 w-3" /> Outras categorias em {cityHuman}
            </Link>
          </nav>
        )}

        {!valid ? (
          <EmptyStateFallback
            title="Página não disponível"
            message="Verifique a URL ou volte para o diretório de categorias."
          />
        ) : isLoading ? (
          // M1 · Skeleton estruturado em vez de spinner/texto genérico —
          // o usuário já enxerga o formato final dos cards enquanto carrega.
          <ul
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            aria-busy="true"
            aria-label="Carregando profissionais"
          >
            <ProviderCardSkeleton count={6} />
          </ul>
        ) : providers.length === 0 ? (

          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum profissional cadastrado nessa cidade ainda. Tente uma busca mais ampla:
            </p>
            <Button asChild size="sm">
              <Link to={`/buscar?q=${encodeURIComponent(categoryHuman)}`}>
                <Search className="h-4 w-4 mr-1" /> Buscar {categoryHuman} em todo o Brasil
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ul
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              data-testid="category-city-list"
            >
              {providers.map((p) => {
                const profileSlug = p.slug || p.id;
                return (
                  <li key={p.id} className="flex flex-col gap-2">
                    <ProviderCard provider={p as any} />
                    <Link
                      to={`/profissional/${profileSlug}`}
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                      data-testid="provider-cta"
                      aria-label={`Ver perfil de ${p.business_name || p.full_name || categoryHuman}`}
                    >
                      Ver perfil <ChevronRight className="h-3 w-3" />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Faixa de CTAs consistentes para /buscar com diferentes filtros */}
            <section
              aria-label="Buscas relacionadas"
              className="mt-8 rounded-xl border border-border bg-card p-5 space-y-3"
              data-testid="category-city-cta-section"
            >
              <h2 className="text-sm font-semibold text-foreground">
                Não achou o ideal? Refine sua busca:
              </h2>
              <div className="flex flex-wrap gap-2 text-xs">
                <Button asChild size="sm" variant="default" data-testid="cta-search-here">
                  <Link to={`/buscar?q=${encodeURIComponent(categoryHuman)}&cidade=${encodeURIComponent(cityHuman)}`}>
                    <Search className="h-3 w-3 mr-1" /> Buscar em {cityHuman}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" data-testid="cta-search-broad">
                  <Link to={`/buscar?q=${encodeURIComponent(categoryHuman)}`}>
                    <Search className="h-3 w-3 mr-1" /> {categoryHuman} em todo o Brasil
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" data-testid="cta-category-list">
                  <Link to={`/categoria/${category!.slug}`}>
                    <Users className="h-3 w-3 mr-1" /> Ver todos {categoryHuman}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" data-testid="cta-city-page">
                  <Link to={`/cidades/${(cidade || '').toLowerCase()}`}>
                    <MapPin className="h-3 w-3 mr-1" /> Outras categorias em {cityHuman}
                  </Link>
                </Button>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Fase 2.9 — adoção runtime SEO (content depth + FAQ + internal links) */}
      {valid && providers.length > 0 && (
        <Suspense fallback={null}>
          <SeoEnhancementSection
            indexation={{
              type: 'category_city',
              path: `/categoria/${slug}/em/${cidade}`,
              slug,
              categorySlug: slug,
              citySlug: cidade,
              providersCount: providers.length,
            }}
            content={{
              categoryName: categoryHuman,
              cityName: cityHuman,
              providersCount: providers.length,
            }}
            faq={{
              categoryName: categoryHuman,
              cityName: cityHuman,
            }}
            links={{
              categorySlug: slug,
              citySlug: cidade,
              relatedNeighborhoods: Array.from(
                new Map(
                  providers
                    .map((p: any) => p?.neighborhood)
                    .filter((n: any) => typeof n === 'string' && n.trim())
                    .map((n: string) => [normalize(n), { name: n, slug: sanitizeSlug(n) }]),
                ).values(),
              ).slice(0, 8),
              highConversionProviders: providers.slice(0, 6).map((p: any) => ({
                name: p.business_name || p.full_name || categoryHuman,
                slug: p.slug || p.id,
              })),
            }}
          />
        </Suspense>
      )}

      <Footer />
    </div>
  );
}
