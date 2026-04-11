import { useState, useMemo, lazy, Suspense } from 'react';
import { importWithRetry } from '@/lib/lazyWithRetry';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Users, MapPin, Globe, Sparkles } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProviderCard from '@/components/ProviderCard';
import PaginationControls from '@/components/PaginationControls';
import GeoFallbackBanner from '@/components/GeoFallbackBanner';
import GeoLocationChip from '@/components/GeoLocationChip';
import EmptyStateFallback from '@/components/EmptyStateFallback';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useCategoryProviders, matchesGeoContext, normalizeCityName, type DbProvider } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useGeoCity } from '@/hooks/useGeoCity';

const AdSlot = lazy(() => importWithRetry(() => import('@/components/ads/AdSlot')));
const SponsorLeaderBanner = lazy(() => importWithRetry(() => import('@/components/sponsors/SponsorLeaderBanner')));
const SponsorTopBanner = lazy(() => importWithRetry(() => import('@/components/sponsors/SponsorTopBanner')));
const SponsorMidContent = lazy(() => importWithRetry(() => import('@/components/sponsors/SponsorMidContent')));
const SponsorFooterCTA = lazy(() => importWithRetry(() => import('@/components/sponsors/SponsorFooterCTA')));

const ITEMS_PER_PAGE = 12;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const CategoryPage = () => {
  const { slug } = useParams();
  const { city: geoCity, state: geoState, latitude: userLat, longitude: userLon, radiusKm } = useGeoCity();
  const { data, isLoading } = useCategoryProviders(slug || '');
  const [page, setPage] = useState(1);
  const [showAllLocations, setShowAllLocations] = useState(false);

  const category = data?.category;
  const allProviders = data?.providers || [];

  const { localProviders, otherProviders, isFallback, expansionLevel } = useMemo(() => {
    if (!geoCity || allProviders.length === 0) {
      return { localProviders: allProviders, otherProviders: [] as DbProvider[], isFallback: false, expansionLevel: null };
    }

    const cityNorm = normalizeCityName(geoCity);
    const stateNorm = geoState ? normalizeCityName(geoState) : undefined;

    const local: DbProvider[] = [];
    const other: DbProvider[] = [];
    allProviders.forEach((p) => {
      if (matchesGeoContext(p, cityNorm, stateNorm, userLat, userLon, radiusKm)) {
        local.push(p);
      } else {
        other.push(p);
      }
    });

    if (local.length > 0) {
      return { localProviders: local, otherProviders: other, isFallback: false, expansionLevel: null };
    }

    return { localProviders: allProviders, otherProviders: [] as DbProvider[], isFallback: true, expansionLevel: 'all' as const };
  }, [allProviders, geoCity, geoState, userLat, userLon, radiusKm]);

  const displayProviders = showAllLocations ? [...localProviders, ...otherProviders] : localProviders;

  useSeoHead({
    title: category ? `${category.name} - Profissionais` : 'Categoria',
    description: category
      ? `Encontre os melhores profissionais de ${category.name}. ${displayProviders.length} cadastrados com avaliações verificadas.`
      : 'Encontre profissionais por categoria.',
    canonical: slug ? `${SITE_BASE_URL}/categoria/${slug}` : undefined,
  });

  const breadcrumbLd = useMemo(() => category ? ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: category.name },
    ],
  }) : null, [category]);

  useJsonLd(breadcrumbLd);

  const paginatedProviders = displayProviders.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <section className="bg-hero py-16">
          <div className="container text-center">
            <Skeleton className="mx-auto h-14 w-14 rounded-2xl" />
            <Skeleton className="mx-auto mt-4 h-8 w-56" />
            <Skeleton className="mx-auto mt-2 h-4 w-40" />
          </div>
        </section>
        <div className="container py-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
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

      {/* Hero section with enhanced visual */}
      <section className="relative bg-hero py-12 md:py-20 overflow-x-clip">
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-accent/8 rounded-full blur-[120px] -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px] translate-y-1/2" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="container relative text-center"
        >
          <Breadcrumbs
            items={[
              { label: 'Categorias', url: '/categorias' },
              { label: category.name },
            ]}
            className="justify-center text-primary-foreground/50 mb-6 text-xs"
          />
          
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-md text-5xl shadow-xl ring-1 ring-white/10"
          >
            {category.icon}
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-5 font-display text-3xl font-bold text-primary-foreground md:text-5xl tracking-tight"
          >
            {category.name}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-2 text-primary-foreground/60 text-sm md:text-base max-w-md mx-auto"
          >
            Encontre os melhores profissionais para o seu projeto
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-5 flex flex-wrap items-center justify-center gap-2"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md px-4 py-2 text-sm font-medium text-primary-foreground ring-1 ring-white/10">
              <Users className="h-3.5 w-3.5 text-accent" />
              {allProviders.length} profissional{allProviders.length !== 1 ? 'is' : ''}
            </span>
            {geoCity && !isFallback && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md px-4 py-2 text-sm font-medium text-primary-foreground ring-1 ring-white/10">
                <MapPin className="h-3.5 w-3.5 text-accent" />
                {geoCity}
              </span>
            )}
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4"
          >
            <GeoLocationChip />
          </motion.div>
        </motion.div>
      </section>

      <Suspense fallback={null}><SponsorLeaderBanner /></Suspense>
      <Suspense fallback={null}><SponsorTopBanner /></Suspense>
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

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {paginatedProviders.map((p, i) => (
            <motion.div key={p.id} variants={fadeUp}>
              {i === 6 && <Suspense fallback={null}><AdSlot slotSlug="category-between" layout="native" category={slug} /></Suspense>}
              {i === 4 && <Suspense fallback={null}><SponsorMidContent /></Suspense>}
              <ProviderCard provider={p} isFallback={isFallback} index={i} />
            </motion.div>
          ))}
        </motion.div>

        {/* Botão para ver profissionais de outras localidades */}
        {!showAllLocations && otherProviders.length > 0 && !isFallback && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 flex justify-center"
          >
            <Button
              variant="outline"
              size="lg"
              onClick={() => { setShowAllLocations(true); setPage(1); }}
              className="gap-2"
            >
              <MapPin className="h-4 w-4" />
              Ver profissionais de outras localidades ({otherProviders.length})
            </Button>
          </motion.div>
        )}

        {showAllLocations && otherProviders.length > 0 && (
          <p className="mt-6 text-sm text-muted-foreground text-center">
            Exibindo também profissionais de outras regiões
          </p>
        )}

        {displayProviders.length === 0 && (
          <EmptyStateFallback
            title={`Nenhum profissional de ${category.name} encontrado`}
            message="Seja o primeiro a se cadastrar nesta categoria!"
          />
        )}

        <PaginationControls currentPage={page} totalItems={displayProviders.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />
      </div>
      
      <Suspense fallback={null}><SponsorFooterCTA category={slug} /></Suspense>
      <Footer />
    </div>
  );
};

export default CategoryPage;
