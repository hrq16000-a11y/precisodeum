/**
 * NeighborhoodPage — `/cidade/:citySlug/bairro/:neighborhoodSlug`
 *
 * Landing SEO programática de longa cauda ("eletricista no batel curitiba").
 * Rota já registrada em `seoRouteRegistry` (type: 'neighborhood', minProviders: 2)
 * — esta é a implementação final da página.
 *
 * Gates anti-thin (memória Core do projeto):
 *  - Slug de cidade/bairro inválido → noindex.
 *  - Cidade não reconhecida (fora do índice IBGE) → noindex.
 *  - < 2 providers reais no bairro → renderiza CTA amplo + noindex.
 *  - Sem doorway: cada página é derivada de dados reais (`providers.neighborhood`).
 *
 * NÃO gera páginas por profissional × cidade que ele atende (doorway clássico).
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from '@/lib/router-compat';
import { motion } from 'framer-motion';
import { ChevronRight, MapPin, Search, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProviderCard from '@/components/ProviderCard';
import ProviderCardSkeleton from '@/components/ProviderCardSkeleton';
import EmptyStateFallback from '@/components/EmptyStateFallback';
import { Button } from '@/components/ui/button';

import { SeoMeta } from '@/components/SeoMeta';
import { DEFAULT_SOCIAL_IMAGE_URL } from '@/lib/siteAssets';
import { useJsonLd } from '@/hooks/useJsonLd';
import { supabase } from '@/integrations/supabase/client';
import { isKnownCity, preloadCitiesIndex } from '@/lib/citiesIndex';
import { normalize } from '@/lib/normalize';
import { buildCanonicalUrl } from '@/lib/canonicalUrl';
import { sanitizeSlug } from '@/lib/slugify';
import { SEO_ROUTE_REGISTRY } from '@/lib/seoRouteRegistry';
import { importWithRetry } from '@/lib/lazyWithRetry';

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

const NEIGHBORHOOD_MIN = SEO_ROUTE_REGISTRY.neighborhood.minProviders;

export default function NeighborhoodPage() {
  const { citySlug, neighborhoodSlug } = useParams<{
    citySlug: string;
    neighborhoodSlug: string;
  }>();

  // PR: preload dataset IBGE para validar cidade (fail-open durante load).
  const [citiesLoaded, setCitiesLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void preloadCitiesIndex().then(() => { if (!cancelled) setCitiesLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const cityHuman = humanizeSlug(citySlug);
  const neighborhoodHuman = humanizeSlug(neighborhoodSlug);
  const cityKnown = useMemo(
    () => (citySlug ? isKnownCity(cityHuman) : false),
    [citySlug, cityHuman],
  );

  // Fetch providers da cidade + bairro (match normalizado).
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['neighborhood-providers', citySlug, neighborhoodSlug],
    enabled: !!citySlug && !!neighborhoodSlug,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const cols =
        'id, user_id, slug, business_name, city, state, neighborhood, ' +
        'rating_avg, review_count, photo_url, description, phone, whatsapp, ' +
        'years_experience, featured, services_count, portfolio_photo_count, ' +
        'created_at, account_type, categories(name, slug, icon)';
      const { data } = await supabase
        .from('providers')
        .select(cols)
        .eq('status', 'approved')
        .ilike('city', `${cityHuman}%`)
        .not('neighborhood', 'is', null)
        .limit(200);
      const targetHood = normalize(neighborhoodHuman);
      const targetCity = normalize(cityHuman);
      return ((data as any[]) || []).filter((p) => {
        const ph = normalize(p?.neighborhood || '');
        const pc = normalize(p?.city || '');
        return ph === targetHood && pc === targetCity;
      });
    },
  });

  // Telemetria de visualização (reusa city_view — bairro é sub-granularidade).
  useEffect(() => {
    if (!citySlug || !neighborhoodSlug) return;
    void import('@/lib/publicFunnelTelemetry').then(({ trackCityView }) =>
      trackCityView({
        city: citySlug,
        source: 'neighborhood_page',
        extra: { neighborhood: neighborhoodSlug },
      } as any),
    );
  }, [citySlug, neighborhoodSlug]);

  const validParams = !!citySlug && !!neighborhoodSlug && cityKnown;
  const hasMinProviders = providers.length >= NEIGHBORHOOD_MIN;
  const shouldIndex = validParams && hasMinProviders;

  const title = validParams
    ? `Profissionais no ${neighborhoodHuman}, ${cityHuman} — Preciso de Um`
    : 'Bairro não encontrado | Preciso de Um';
  const description = validParams
    ? `${providers.length} ${providers.length === 1 ? 'profissional verificado' : 'profissionais verificados'} atendendo o bairro ${neighborhoodHuman}, em ${cityHuman}. Contato direto pelo WhatsApp, sem intermediários.`
    : 'Esta combinação de cidade/bairro não está disponível.';

  const canonical = validParams
    ? buildCanonicalUrl(`/cidade/${citySlug}/bairro/${neighborhoodSlug}`)
    : undefined;

  // JSON-LD ItemList apenas quando indexável (evita lixo).
  useJsonLd(
    shouldIndex
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `Profissionais em ${neighborhoodHuman}, ${cityHuman}`,
          numberOfItems: providers.length,
          itemListElement: providers.slice(0, 20).map((p: any, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: buildCanonicalUrl(`/profissional/${p.slug || p.id}`),
            name: p.business_name || 'Profissional',
          })),
        }
      : null,
    `neighborhood-${citySlug}-${neighborhoodSlug}`,
  );

  // Categorias distintas presentes no bairro — cross-links de alto valor SEO.
  const relatedCategories = useMemo(() => {
    const seen = new Map<string, { name: string; slug: string }>();
    for (const p of providers as any[]) {
      const c = p?.categories;
      if (c?.slug && c?.name && !seen.has(c.slug)) {
        seen.set(c.slug, { name: c.name, slug: c.slug });
      }
    }
    return Array.from(seen.values()).slice(0, 8);
  }, [providers]);

  const breadcrumbs = useMemo(
    () => [
      { label: 'Início', url: '/' },
      { label: 'Cidades', url: '/cidades' },
      ...(cityKnown ? [{ label: cityHuman, url: `/cidade/${citySlug}` }] : []),
      ...(validParams
        ? [{ label: neighborhoodHuman, url: `/cidade/${citySlug}/bairro/${neighborhoodSlug}` }]
        : []),
    ],
    [citySlug, cityHuman, cityKnown, neighborhoodSlug, neighborhoodHuman, validParams],
  );

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      data-seo-ready={!isLoading && validParams ? 'true' : undefined}
    >
      <SeoMeta
        title={title}
        description={description}
        canonical={canonical}
        noindex={!shouldIndex}
        ogImage={DEFAULT_SOCIAL_IMAGE_URL}
      />
      <Header />

      <main className="flex-1 mx-auto w-full max-w-screen-xl px-4 py-6 space-y-6">
        <Breadcrumbs items={breadcrumbs} />

        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            {validParams ? (
              <>
                Profissionais no <span className="text-primary">{neighborhoodHuman}</span>, {cityHuman}
              </>
            ) : (
              'Bairro não encontrado'
            )}
          </h1>
          {validParams && (
            <p className="text-sm text-muted-foreground max-w-2xl">
              {isLoading
                ? 'Carregando profissionais do bairro…'
                : hasMinProviders
                  ? `${providers.length} ${providers.length === 1 ? 'profissional verificado' : 'profissionais verificados'} atendendo o bairro ${neighborhoodHuman} em ${cityHuman}.`
                  : `Ainda temos poucos profissionais cadastrados no ${neighborhoodHuman}. Amplie a busca para ver todos em ${cityHuman}.`}
            </p>
          )}
        </motion.header>

        {validParams && (
          <nav aria-label="Atalhos de busca" className="flex flex-wrap gap-2 text-xs">
            <Link
              to={`/buscar?cidade=${encodeURIComponent(cityHuman)}&bairro=${encodeURIComponent(neighborhoodHuman)}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:bg-accent"
              data-testid="cta-search-neighborhood"
            >
              <Search className="h-3 w-3" /> Buscar no {neighborhoodHuman}
            </Link>
            <Link
              to={`/cidade/${citySlug}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:bg-accent"
              data-testid="cta-city-page"
            >
              <MapPin className="h-3 w-3" /> Todos os bairros de {cityHuman}
            </Link>
          </nav>
        )}

        {!validParams ? (
          <EmptyStateFallback
            title="Página não disponível"
            message="Verifique a URL ou volte para o diretório de cidades."
          />
        ) : isLoading ? (
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
              Nenhum profissional cadastrado no {neighborhoodHuman} ainda. Amplie a busca:
            </p>
            <Button asChild size="sm">
              <Link to={`/cidade/${citySlug}`}>
                <MapPin className="h-4 w-4 mr-1" /> Ver profissionais em {cityHuman}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ul
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              data-testid="neighborhood-list"
            >
              {(providers as any[]).map((p) => {
                const profileSlug = p.slug || p.id;
                return (
                  <li key={p.id} className="flex flex-col gap-2">
                    <ProviderCard provider={p as any} />
                    <Link
                      to={`/profissional/${profileSlug}`}
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                      data-testid="provider-cta"
                      aria-label={`Ver perfil de ${p.business_name || 'profissional'}`}
                    >
                      Ver perfil <ChevronRight className="h-3 w-3" />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {relatedCategories.length > 0 && (
              <section
                aria-label="Categorias no bairro"
                className="mt-8 rounded-xl border border-border bg-card p-5 space-y-3"
              >
                <h2 className="text-sm font-semibold text-foreground">
                  Categorias com profissionais no {neighborhoodHuman}:
                </h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  {relatedCategories.map((c) => (
                    <Link
                      key={c.slug}
                      to={`/categoria/${c.slug}/em/${citySlug}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 font-medium hover:bg-accent"
                    >
                      {c.name} em {cityHuman}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {shouldIndex && (
        <Suspense fallback={null}>
          <SeoEnhancementSection
            indexation={{
              type: 'neighborhood',
              path: `/cidade/${citySlug}/bairro/${neighborhoodSlug}`,
              slug: neighborhoodSlug,
              citySlug,
              providersCount: providers.length,
            }}
            content={{
              cityName: cityHuman,
              neighborhoodName: neighborhoodHuman,
              providersCount: providers.length,
            } as any}
            faq={{
              cityName: cityHuman,
              neighborhoodName: neighborhoodHuman,
            } as any}
            links={{
              citySlug,
              neighborhoodSlug,
              relatedCategories: relatedCategories.map((c) => ({
                name: c.name,
                slug: c.slug,
              })),
              highConversionProviders: (providers as any[]).slice(0, 6).map((p) => ({
                name: p.business_name || 'Profissional',
                slug: p.slug || p.id,
              })),
            } as any}
          />
        </Suspense>
      )}

      <Footer />
    </div>
  );
}
