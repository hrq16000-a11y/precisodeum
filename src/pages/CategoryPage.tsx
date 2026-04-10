import { useState, useMemo, lazy, Suspense } from 'react';
import { importWithRetry } from '@/lib/lazyWithRetry';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Users, MapPin } from 'lucide-react';
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
import { useCategoryProviders, matchesGeoContext, normalizeCityName } from '@/hooks/useProviders';
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

  const category = data?.category;
  const allProviders = data?.providers || [];

  const { displayProviders, isFallback, expansionLevel } = useMemo(() => {
    if (!geoCity || allProviders.length === 0) {
      return { displayProviders: allProviders, isFallback: false, expansionLevel: null };
    }

    const cityNorm = normalizeCityName(geoCity);
    const stateNorm = geoState ? normalizeCityName(geoState) : undefined;

    const localResults = allProviders.filter((p) =>
      matchesGeoContext(p, cityNorm, stateNorm, userLat, userLon, radiusKm)
    );

    if (localResults.length > 0) {
      return { displayProviders: localResults, isFallback: false, expansionLevel: null };
    }

    return { displayProviders: allProviders, isFallback: true, expansionLevel: 'all' as const };
  }, [allProviders, geoCity, geoState, userLat, userLon, radiusKm]);

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
      <section className="relative bg-hero py-16 overflow-x-clip">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl -translate-y-1/2" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="container relative text-center"
        >
          {/* Breadcrumb */}
          <Breadcrumbs
            items={[
              { label: 'Categorias', url: '/categorias' },
              { label: category.name },
            ]}
            className="justify-center text-primary-foreground/60 mb-4"
          />
          
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm text-4xl shadow-lg"
          >
            {category.icon}
          </motion.span>
          
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 font-display text-3xl font-bold text-primary-foreground md:text-4xl"
          >
            {category.name}
          </motion.h1>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-3 flex flex-wrap items-center justify-center gap-3"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-sm font-medium text-primary-foreground">
              <Users className="h-3.5 w-3.5" />
              {displayProviders.length} profissional(is)
            </span>
            {geoCity && !isFallback && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-sm font-medium text-primary-foreground">
                <MapPin className="h-3.5 w-3.5" />
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
