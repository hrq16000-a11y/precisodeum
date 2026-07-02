import { useState, useMemo, lazy, Suspense } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import PaginationControls from '@/components/PaginationControls';
import GeoFallbackBanner from '@/components/GeoFallbackBanner';
import GeoLocationChip from '@/components/GeoLocationChip';
import EmptyStateFallback from '@/components/EmptyStateFallback';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoryProviders } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useGeoCity } from '@/hooks/useGeoCity';

const AdSlot = lazy(() => import('@/components/ads/AdSlot'));

const ITEMS_PER_PAGE = 12;

const CategoryPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { city: geoCity, state: geoState } = useGeoCity();
  const { data, isLoading } = useCategoryProviders(slug || '');
  const [page, setPage] = useState(1);

  const category = data?.category;
  const allProviders = useMemo(() => data?.providers || [], [data?.providers]);
  const availableCities = useMemo(() => {
    const cityMap = new Map<string, { city: string; state: string }>();
    allProviders.forEach((provider) => {
      const cityName = provider.city?.trim();
      if (!cityName) return;
      const key = cityName.toLowerCase();
      if (!cityMap.has(key)) {
        cityMap.set(key, { city: cityName, state: provider.state || '' });
      }
    });
    return Array.from(cityMap.values()).slice(0, 12);
  }, [allProviders]);

  // Filter by geo city first, then fallback
  const { displayProviders, isFallback, expansionLevel } = useMemo(() => {
    if (!geoCity || allProviders.length === 0) {
      return { displayProviders: allProviders, isFallback: false, expansionLevel: null };
    }

    const lc = geoCity.toLowerCase();
    const cityResults = allProviders.filter(
      (p) => p.city.toLowerCase().includes(lc) || p.neighborhood.toLowerCase().includes(lc)
    );
    if (cityResults.length > 0) {
      return { displayProviders: cityResults, isFallback: false, expansionLevel: null };
    }

    // Fallback to state
    if (geoState) {
      const ls = geoState.toLowerCase();
      const stateResults = allProviders.filter((p) => p.state.toLowerCase() === ls);
      if (stateResults.length > 0) {
        return { displayProviders: stateResults, isFallback: true, expansionLevel: 'state' as const };
      }
    }

    // Show all
    return { displayProviders: allProviders, isFallback: true, expansionLevel: 'all' as const };
  }, [allProviders, geoCity, geoState]);

  useSeoHead({
    title: category ? `${category.name} - Profissionais` : 'Categoria',
    description: category
      ? `Encontre os melhores profissionais de ${category.name}. ${displayProviders.length} cadastrados com avaliações verificadas.`
      : 'Encontre profissionais por categoria.',
    canonical: slug ? `${SITE_BASE_URL}/categoria/${slug}` : undefined,
    noindex: !!category && displayProviders.length === 0,
  });

  const breadcrumbLd = useMemo(() => category ? ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: category.name },
    ],
  }) : null, [category]);
  const itemListLd = useMemo(() => {
    if (!category || displayProviders.length === 0) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${category.name} no Preciso de um`,
      itemListElement: displayProviders.slice(0, 12).map((provider, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE_BASE_URL}/profissional/${provider.slug}`,
        name: provider.name,
      })),
    };
  }, [category, displayProviders]);

  useJsonLd(breadcrumbLd);
  useJsonLd(itemListLd);

  const paginatedProviders = displayProviders.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (category?.slug && slug && category.slug !== slug) {
    navigate(`/categoria/${category.slug}`, { replace: true });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <section className="bg-hero py-12">
          <div className="container text-center">
            <Skeleton className="mx-auto h-10 w-10 rounded-full" />
            <Skeleton className="mx-auto mt-3 h-8 w-48" />
          </div>
        </section>
        <div className="container py-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container flex flex-1 items-center justify-center py-20">
          <p className="text-lg text-muted-foreground">Categoria não encontrada.</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <section className="bg-hero py-12">
        <div className="container text-center">
          <span className="text-4xl">{category.icon}</span>
          <h1 className="mt-3 font-display text-3xl font-bold text-primary-foreground md:text-4xl">
            {category.name}
          </h1>
          <p className="mt-2 text-primary-foreground/70">
            {displayProviders.length} profissional(is) {geoCity && !isFallback ? `em ${geoCity}` : 'cadastrado(s)'}
          </p>
          <div className="mt-3"><GeoLocationChip /></div>
        </div>
      </section>
      <Suspense fallback={null}><AdSlot slotSlug="category-top" category={slug} /></Suspense>
      <div className="container py-8">
        {isFallback && expansionLevel && (
          <GeoFallbackBanner
            originalCity={geoCity || ''}
            expansionLevel={expansionLevel}
            stateName={geoState || undefined}
            resultCount={displayProviders.length}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedProviders.map((p, i) => (
            <>{i === 6 && <Suspense key="cat-ad" fallback={null}><AdSlot slotSlug="category-between" layout="native" category={slug} /></Suspense>}<ProviderCard key={p.id} provider={p} isFallback={isFallback} /></>
          ))}
        </div>
        {displayProviders.length === 0 && (
          <EmptyStateFallback
            title={`Nenhum profissional de ${category.name} encontrado`}
            message="Seja o primeiro a se cadastrar nesta categoria!"
          />
        )}
        <PaginationControls currentPage={page} totalItems={displayProviders.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />

        {category && availableCities.length > 0 && (
          <section className="mt-10 rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-xl font-bold text-foreground">
              {category.name} em cidades com profissionais cadastrados
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Navegue pelas cidades onde já existe cobertura real de profissionais desta categoria.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {availableCities.map(({ city, state }) => {
                const citySlug = city
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase()
                  .replace(/[_\s]+/g, '-')
                  .replace(/[^a-z0-9-]/g, '')
                  .replace(/-{2,}/g, '-')
                  .replace(/^-+|-+$/g, '');

                return (
                  <Link
                    key={`${city}-${state}`}
                    to={`/${category.slug}-${citySlug}`}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {category.name} em {city}{state ? ` - ${state}` : ''}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CategoryPage;
