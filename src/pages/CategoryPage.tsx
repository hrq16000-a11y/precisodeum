import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { importWithRetry } from '@/lib/lazyWithRetry';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Users, MapPin, Globe, Sparkles } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProviderCard from '@/components/ProviderCard';
import PaginationControls from '@/components/PaginationControls';
import GeoFallbackBanner from '@/components/GeoFallbackBanner';
import GeoLocationChip from '@/components/GeoLocationChip';
import GeoPromptBanner from '@/components/GeoPromptBanner';
import EmptyStateFallback from '@/components/EmptyStateFallback';
import { Skeleton } from '@/components/ui/skeleton';
import ProviderCardSkeleton from '@/components/ProviderCardSkeleton';
import { Button } from '@/components/ui/button';
import { useCategoryProviders, matchesGeoContext, normalizeCityName, type DbProvider } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useGeoCity } from '@/hooks/useGeoCity';
import { calculateDistanceKm } from '@/lib/geoDistance';

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) =>
  calculateDistanceKm({ latitude: lat1, longitude: lon1 }, { latitude: lat2, longitude: lon2 });

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
  const { city: geoCity, state: geoState, latitude: userLat, longitude: userLon, radiusKm, setRadius, requestPreciseLocation } = useGeoCity();
  const { data, isLoading } = useCategoryProviders(slug || '');
  const [page, setPage] = useState(1);
  
  const [showOutOfState, setShowOutOfState] = useState(false);

  // Request GPS proactively on mount
  useEffect(() => {
    requestPreciseLocation();
  }, [requestPreciseLocation]);

  const category = data?.category;
  const allProviders = data?.providers || [];

  const { localProviders, nearbyProviders, outOfStateProviders, isFallback, expansionLevel } = useMemo(() => {
    if (!geoCity || allProviders.length === 0) {
      return { localProviders: allProviders, nearbyProviders: [] as DbProvider[], outOfStateProviders: [] as DbProvider[], isFallback: false, expansionLevel: null };
    }

    const cityNorm = normalizeCityName(geoCity);
    const stateNorm = geoState ? normalizeCityName(geoState) : undefined;
    const userStateNorm = geoState ? normalizeCityName(geoState) : '';

    const local: (DbProvider & { _dist?: number })[] = [];
    const other: (DbProvider & { _dist?: number })[] = [];
    allProviders.forEach((p) => {
      let dist: number | undefined;
      if (userLat != null && userLon != null && p.latitude != null && p.longitude != null) {
        dist = Math.round(haversine(userLat, userLon, p.latitude, p.longitude) * 10) / 10;
      }
      if (matchesGeoContext(p, cityNorm, stateNorm, userLat, userLon, radiusKm)) {
        local.push({ ...p, distanceKm: dist, _dist: dist });
      } else {
        other.push({ ...p, distanceKm: dist, _dist: dist });
      }
    });

    const distSort = (a: { _dist?: number; city?: string }, b: { _dist?: number; city?: string }) => {
      // Tier 1: same city as user always ranks first
      if (cityNorm) {
        const aMatch = normalizeCityName(a.city || '') === cityNorm;
        const bMatch = normalizeCityName(b.city || '') === cityNorm;
        if (aMatch !== bMatch) return aMatch ? -1 : 1;
      }
      // Tier 2: sort by distance
      const distA = a._dist ?? Infinity;
      const distB = b._dist ?? Infinity;
      if (distA !== Infinity && distB !== Infinity) {
        const diff = distA - distB;
        if (Math.abs(diff) > 1) return diff;
      }
      if (distA === Infinity && distB !== Infinity) return 1;
      if (distB === Infinity && distA !== Infinity) return -1;
      return 0;
    };

    if (userLat != null && userLon != null) {
      local.sort(distSort);
      other.sort(distSort);
    }

    // Split other into nearby (same state or <100km) vs outOfState
    const splitNearbyOutOfState = (arr: typeof other) => {
      const nearby: typeof other = [];
      const outOfState: typeof other = [];
      arr.forEach(p => {
        const provStateNorm = normalizeCityName(p.state);
        const isNearby = (userStateNorm && provStateNorm === userStateNorm) || ((p._dist ?? Infinity) < 100);
        if (isNearby) nearby.push(p);
        else outOfState.push(p);
      });
      return { nearby, outOfState };
    };

    if (local.length > 0) {
      const { nearby, outOfState } = splitNearbyOutOfState(other);
      return { localProviders: local as DbProvider[], nearbyProviders: nearby as DbProvider[], outOfStateProviders: outOfState as DbProvider[], isFallback: false, expansionLevel: null };
    }

    // Fallback: 0 local → combine and split
    const allSorted = [...local, ...other];
    if (userLat != null && userLon != null) allSorted.sort(distSort);
    const { nearby, outOfState } = splitNearbyOutOfState(allSorted);
    return { localProviders: [] as DbProvider[], nearbyProviders: nearby as DbProvider[], outOfStateProviders: outOfState as DbProvider[], isFallback: true, expansionLevel: 'all' as const };
  }, [allProviders, geoCity, geoState, userLat, userLon, radiusKm]);

  const nearestProvider = localProviders.length > 0 ? localProviders[0] : (nearbyProviders.length > 0 ? nearbyProviders[0] : undefined);
  const nearestDistanceKm = (nearestProvider as any)?._dist;
  const nearestCity = nearestProvider?.city;
  const totalDisplay = localProviders.length + nearbyProviders.length + (showOutOfState ? outOfStateProviders.length : 0);

  useSeoHead({
    title: category ? `${category.name} - Profissionais` : 'Categoria',
    description: category
      ? `Encontre os melhores profissionais de ${category.name}. ${allProviders.length} cadastrados com avaliações verificadas.`
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

  const paginatedLocal = localProviders.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const paginatedNearby = nearbyProviders;
  const paginatedOutOfState = showOutOfState ? outOfStateProviders : [];

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
            <ProviderCardSkeleton count={6} />
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
      <section className="relative bg-hero py-6 md:py-20 overflow-x-clip">
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
            variant="hero"
            className="justify-center mb-6"
          />
          
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex h-14 w-14 md:h-20 md:w-20 items-center justify-center rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-md shadow-xl ring-1 ring-white/10"
          >
            <CategoryIcon icon={category.icon} size={28} className="text-white md:hidden" />
            <CategoryIcon icon={category.icon} size={40} className="text-white hidden md:block" />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-3 md:mt-5 font-display text-2xl font-bold text-primary-foreground md:text-5xl tracking-tight"
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

      <div className="container px-4 py-8">
        <GeoPromptBanner />

        {isFallback && expansionLevel && (
          <GeoFallbackBanner
            originalCity={geoCity || ''}
            expansionLevel={expansionLevel}
            stateName={geoState || undefined}
            resultCount={allProviders.length}
            nearestDistanceKm={nearestDistanceKm}
            nearestCity={nearestCity}
          />
        )}

        {!isFallback && nearestDistanceKm != null && nearestDistanceKm > 50 && (
          <GeoFallbackBanner
            originalCity={geoCity || ''}
            expansionLevel="all"
            stateName={geoState || undefined}
            resultCount={localProviders.length}
            nearestDistanceKm={nearestDistanceKm}
            nearestCity={nearestCity}
          />
        )}

        {/* Local results grid */}
        {geoCity && !isFallback && localProviders.length > 0 && (
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">
              Na sua região (até {radiusKm}km)
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {paginatedLocal.map((p, i) => (
            <motion.div key={p.id} variants={fadeUp}>
              {i === 6 && <Suspense fallback={null}><AdSlot slotSlug="category-between" layout="native" category={slug} /></Suspense>}
              {i === 4 && <Suspense fallback={null}><SponsorMidContent /></Suspense>}
              <ProviderCard provider={p} isFallback={isFallback} index={i} />
            </motion.div>
          ))}
        </motion.div>

        {/* Nearby cities section (same state / <100km) */}
        {paginatedNearby.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 mb-3 flex items-center gap-3"
            >
              <div className="h-px flex-1 bg-border" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3 w-3" />
                Cidades próximas ({nearbyProviders.length})
              </span>
              <div className="h-px flex-1 bg-border" />
            </motion.div>
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {paginatedNearby.map((p, i) => (
                <motion.div key={p.id} variants={fadeUp}>
                  <ProviderCard provider={p} isFallback={isFallback} index={i} />
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        {/* Out of state — collapsed by default */}
        {outOfStateProviders.length > 0 && !showOutOfState && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 flex justify-center"
          >
            <button
              onClick={() => { setShowOutOfState(true); setPage(1); }}
              className="group relative inline-flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 px-6 py-4 text-sm font-semibold text-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <Globe className="h-5 w-5" />
              </span>
              <span className="text-left">
                <span className="block text-sm font-semibold">Profissionais de outro estado ({outOfStateProviders.length})</span>
                <span className="block text-xs text-muted-foreground">Deseja ver? Ver mais...</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        )}

        {showOutOfState && paginatedOutOfState.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 mb-3 flex items-center gap-3"
            >
              <div className="h-px flex-1 bg-border" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Globe className="h-3 w-3" />
                Outro estado ({outOfStateProviders.length})
              </span>
              <div className="h-px flex-1 bg-border" />
            </motion.div>
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {paginatedOutOfState.map((p, i) => (
                <motion.div key={p.id} variants={fadeUp}>
                  <ProviderCard provider={p} isFallback={true} index={i} />
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        {/* Auto-expand suggestion when 0 local results and 0 nearby */}
        {!isFallback && localProviders.length === 0 && nearbyProviders.length === 0 && outOfStateProviders.length > 0 && userLat != null && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-8 flex flex-col items-center gap-4 rounded-2xl border border-accent/20 bg-accent/5 p-6 text-center"
          >
            <Sparkles className="h-8 w-8 text-accent" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Nenhum profissional de {category.name} a até {radiusKm}km
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Encontramos {outOfStateProviders.length} profissional{outOfStateProviders.length !== 1 ? 'is' : ''} em outros estados
              </p>
            </div>
            <div className="flex gap-2">
              {radiusKm < 50 && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRadius(50)}>
                  Expandir para 50km
                </Button>
              )}
              <Button size="sm" className="gap-1.5" onClick={() => { setShowOutOfState(true); setPage(1); }}>
                <Globe className="h-3.5 w-3.5" />
                Ver outros estados
              </Button>
            </div>
          </motion.div>
        )}

        {totalDisplay === 0 && outOfStateProviders.length === 0 && (
          <EmptyStateFallback
            title={`Nenhum profissional de ${category.name} encontrado`}
            message="Seja o primeiro a se cadastrar nesta categoria!"
          />
        )}

        <PaginationControls currentPage={page} totalItems={totalDisplay} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />
      </div>
      
      <Suspense fallback={null}><SponsorFooterCTA category={slug} /></Suspense>
      <Footer />
    </div>
  );
};

export default CategoryPage;
