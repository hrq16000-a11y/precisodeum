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
import { useCategoryProviders, filterAndRankProvidersGrouped, type DbProvider } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useGeoCity } from '@/hooks/useGeoCity';
import { calculateDistanceKm } from '@/lib/geoDistance';
import { getSeoAuthorityData } from '@/lib/seoAuthority';
import CategorySeoBlock from '@/components/CategorySeoBlock';
import { isKnownCity } from '@/lib/citiesIndex';
import { normalize } from '@/lib/normalize';
import { lintServiceDescription } from '@/lib/serviceQualityLinter';
import { useSettingValue } from '@/hooks/useSiteSettings';

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

    const ranked = filterAndRankProvidersGrouped(
      allProviders,
      category?.name || '',
      geoCity,
      slug || '',
      0,
      geoState || '',
      userLat,
      userLon,
      radiusKm,
    );

    return {
      localProviders: ranked.local,
      nearbyProviders: ranked.nearby,
      outOfStateProviders: ranked.outOfState,
      isFallback: ranked.isFallback,
      expansionLevel: ranked.isFallback ? 'all' as const : null,
    };
  }, [allProviders, category?.name, geoCity, geoState, radiusKm, slug, userLat, userLon]);

  const nearestProvider = localProviders.length > 0 ? localProviders[0] : (nearbyProviders.length > 0 ? nearbyProviders[0] : undefined);
  const nearestDistanceKm = (nearestProvider as any)?._dist;
  const nearestCity = nearestProvider?.city;
  const totalDisplay = localProviders.length + nearbyProviders.length + (showOutOfState ? outOfStateProviders.length : 0);
  const categorySocialImage = nearestProvider?.photo || allProviders.find((provider) => provider.photo)?.photo;

  // ── Filtro de qualidade SEO: só providers com cidade validada (catálogo IBGE)
  // e descrição/about sem termos de leilão. Score mínimo configurável via
  // site_settings.service_quality_min_score (default 60).
  const minScoreSetting = useSettingValue('service_quality_min_score');
  const minScore = useMemo(() => {
    const raw = minScoreSetting;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? '60'), 10);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 60;
  }, [minScoreSetting]);

  const seoEligibleProviders = useMemo(() => {
    return allProviders.filter((p: any) => {
      if (!p?.city) return false;
      if (!isKnownCity(normalize(p.city))) return false;
      const about = String(p.about || p.description || '');
      if (about && lintServiceDescription(about).length > 0) return false;
      // Score heurístico: cidade válida=40, foto=20, sobre 80+ chars=20, telefone=10, business_name=10
      let score = 40;
      if (p.photo) score += 20;
      if (about.trim().length >= 80) score += 20;
      if (p.whatsapp || p.phone) score += 10;
      if (p.businessName || p.business_name) score += 10;
      return score >= minScore;
    });
  }, [allProviders, minScore]);

  const cityForSeo = geoCity ? geoCity.trim() : '';
  const dynamicTitle = category
    ? (cityForSeo
        ? `${category.name} em ${cityForSeo} - Profissionais Verificados | Preciso de Um`
        : `${category.name} no Brasil - Profissionais Verificados | Preciso de Um`)
    : 'Categoria';
  const seoCount = seoEligibleProviders.length || allProviders.length;
  const dynamicDescription = category
    ? (cityForSeo
        ? `Os melhores profissionais de ${category.name} em ${cityForSeo}. ${seoCount} prestadores com cidade validada e perfil completo. Orçamento grátis pelo WhatsApp.`
        : `Encontre os melhores profissionais de ${category.name} no Brasil. ${seoCount} prestadores com perfil completo e cidade validada.`)
    : 'Encontre profissionais por categoria.';

  useSeoHead({
    title: dynamicTitle,
    description: dynamicDescription,
    canonical: slug ? `${SITE_BASE_URL}/categoria/${slug}` : undefined,
    ogImage: categorySocialImage || undefined,
    noindex: !category,
  });

  const breadcrumbLd = useMemo(() => category ? ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Categorias', item: `${SITE_BASE_URL}/categorias` },
      { '@type': 'ListItem', position: 3, name: category.name, item: `${SITE_BASE_URL}/categoria/${category.slug}` },
    ],
  }) : null, [category]);

  // Helper: filtra os providers já rankeados pelo critério SEO de qualidade
  const eligibleIds = useMemo(() => new Set(seoEligibleProviders.map((p: any) => p.id)), [seoEligibleProviders]);
  const filteredForSeo = useMemo(() => {
    const merged = [...localProviders, ...nearbyProviders];
    const filtered = merged.filter((p: any) => eligibleIds.has(p.id));
    // Fallback: se o filtro zerar, mantém os top 10 originais para não quebrar Rich Results
    return (filtered.length > 0 ? filtered : merged).slice(0, 10);
  }, [localProviders, nearbyProviders, eligibleIds]);

  // Service schema with ItemList of providers and aggregate ratings (Rich Snippets)
  const serviceLd = useMemo(() => {
    if (!category) return null;
    const { aggregateRating } = getSeoAuthorityData(filteredForSeo);
    const aggregate = aggregateRating ? { aggregateRating } : {};
    return {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: cityForSeo ? `${category.name} em ${cityForSeo}` : category.name,
      serviceType: category.name,
      areaServed: cityForSeo ? { '@type': 'City', name: cityForSeo } : { '@type': 'Country', name: 'Brasil' },
      provider: {
        '@type': 'Organization',
        name: 'Preciso de um',
        url: SITE_BASE_URL,
      },
      url: `${SITE_BASE_URL}/categoria/${category.slug}`,
      ...aggregate,
    };
  }, [category, filteredForSeo, cityForSeo]);

  const itemListLd = useMemo(() => {
    if (!category) return null;
    if (filteredForSeo.length === 0) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: filteredForSeo.map((p, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `${SITE_BASE_URL}/profissional/${p.slug}`,
        name: p.businessName || p.name || 'Profissional',
      })),
    };
  }, [category, filteredForSeo]);

  // CollectionPage envelope — sinaliza ao Google que esta é uma página de coleção
  const collectionLd = useMemo(() => category ? ({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: cityForSeo ? `${category.name} em ${cityForSeo}` : category.name,
    url: `${SITE_BASE_URL}/categoria/${category.slug}`,
    isPartOf: { '@type': 'WebSite', url: SITE_BASE_URL, name: 'Preciso de um' },
    about: { '@type': 'Service', name: category.name },
  }) : null, [category, cityForSeo]);

  useJsonLd(breadcrumbLd);
  useJsonLd(serviceLd);
  useJsonLd(itemListLd);
  useJsonLd(collectionLd);

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
      
      <CategorySeoBlock
        categorySlug={slug || ''}
        categoryName={category.name}
        city={geoCity}
        state={geoState}
        providersCount={totalDisplay}
      />
      <Suspense fallback={null}><SponsorFooterCTA category={slug} /></Suspense>
      <Footer />
    </div>
  );
};

export default CategoryPage;
