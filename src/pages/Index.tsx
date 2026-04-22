import { lazy as reactLazy, Suspense, Component, ReactNode, type ComponentType, useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHomeFeatureFlags } from '@/hooks/useHomeFeatureFlags';
import { useCategoriesWithCount, useFeaturedProviders } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { importWithRetry } from '@/lib/lazyWithRetry';
import { useGeoCity } from '@/hooks/useGeoCity';

// Critical path — eagerly loaded for instant render
import Header from '@/components/Header';
import HeroBanner from '@/components/home/HeroBanner';
import CategoriesGrid from '@/components/home/CategoriesGrid';
import Footer from '@/components/Footer';

type LazyModule<T extends ComponentType<any>> = { default: T };
const lazy = <T extends ComponentType<any>>(importer: () => Promise<LazyModule<T>>) =>
  reactLazy(() => importWithRetry(importer));

// Lazy load non-critical sections (below the fold)
const UrgencyBanner = lazy(() => import('@/components/home/UrgencyBanner'));
const HighlightsCarousel = lazy(() => import('@/components/home/HighlightsCarousel'));
const FeaturedProviders = lazy(() => import('@/components/home/FeaturedProviders'));
const StatsCounter = lazy(() => import('@/components/home/StatsCounter'));
const PwaInstallSection = lazy(() => import('@/components/home/PwaInstallSection'));
const DynamicPageBlocks = lazy(() => import('@/components/DynamicPageBlocks'));
const PopularServices = lazy(() => import('@/components/home/PopularServices'));
const FeaturedJobs = lazy(() => import('@/components/home/FeaturedJobs'));
const BlogHighlight = lazy(() => import('@/components/home/BlogHighlight'));
const CitiesSection = lazy(() => import('@/components/home/CitiesSection'));
const CtaSection = lazy(() => import('@/components/home/CtaSection'));
const SponsorsSection = lazy(() => import('@/components/home/SponsorsSection'));
const SponsorLeaderBanner = lazy(() => import('@/components/sponsors/SponsorLeaderBanner'));
const HowItWorksSection = lazy(() => import('@/components/home/HowItWorksSection'));
const TestimonialsSection = lazy(() => import('@/components/home/TestimonialsSection'));
const FaqSection = lazy(() => import('@/components/home/FaqSection'));
const PopularSearches = lazy(() => import('@/components/home/PopularSearches'));
const AdBanner = lazy(() => import('@/components/ads/AdBanner'));
const AdShowcase = lazy(() => import('@/components/ads/AdShowcase'));
const AdSlot = lazy(() => import('@/components/ads/AdSlot'));
const SponsorAdSlot = lazy(() => import('@/components/ads/SponsorAdSlot'));
const SponsorTopBanner = lazy(() => import('@/components/sponsors/SponsorTopBanner'));
const SponsorFooterCTA = lazy(() => import('@/components/sponsors/SponsorFooterCTA'));
const CmsBannersCarousel = lazy(() => import('@/components/home/CmsBannersCarousel'));
const CoursesPromo = lazy(() => import('@/components/home/CoursesPromo'));
const CommunityFeed = lazy(() => import('@/components/dashboard/CommunityFeed'));

const FloatingWhatsApp = lazy(() => import('@/components/FloatingWhatsApp'));
const ActiveProvidersCounter = lazy(() => import('@/components/home/ActiveProvidersCounter'));

// Error boundary to prevent lazy load failures from crashing the page
class LazyErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <p className="text-sm text-muted-foreground">Algo deu errado ao carregar esta seção.</p>
          <a
            href="/ajuda"
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Acionar suporte
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

// Instant fallback — no blocking skeletons

const SectionFallback = () => null;

const DeferredAboveFoldSection = ({ children }: { children: ReactNode }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(() => setReady(true), { timeout: 1800 });
      return () => (window as any).cancelIdleCallback?.(id);
    }

    const id = window.setTimeout(() => setReady(true), 900);
    return () => window.clearTimeout(id);
  }, []);

  return ready ? <>{children}</> : null;
};

const LazyViewportSection = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;

    if (!('IntersectionObserver' in window)) {
      const id = window.setTimeout(() => setVisible(true), 1200);
      return () => window.clearTimeout(id);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '650px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return <div ref={ref} className="cv-auto">{visible ? children : null}</div>;
};

// Default section order
const DEFAULT_ORDER = 'cms_banners,urgency,leader_sponsor,sponsor_top,home_featured_ad,highlights,stats,categories,pwa,dynamic,ad1,featured,popular,ad2,jobs,courses,blog,cities,cta,showcase,sponsors,howitworks,searches,testimonials,faq,sponsor_cta';

// Sections that appear before 'categories' in the default order load lazily,
// each one pushing the categories grid down and causing a layout shift.
// To eliminate this CLS we render CategoriesGrid eagerly (it's already imported)
// right after HeroBanner, outside the lazy section loop.

const Index = () => {
  const { city: geoCity } = useGeoCity();

  useSeoHead({
    title: geoCity
      ? `Profissionais confiáveis em ${geoCity} | Preciso de um`
      : 'Preciso de um | Encontre um profissional para qualquer tipo de serviço no Brasil',
    description: geoCity
      ? `Encontre eletricistas, encanadores, técnicos e mais em ${geoCity}. Compare avaliações e solicite orçamentos gratuitamente.`
      : 'Marketplace de serviços profissionais. Encontre eletricistas, encanadores, técnicos e muito mais na sua cidade. Cadastre-se gratuitamente.',
    canonical: SITE_BASE_URL,
  });

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Preciso de um',
    url: SITE_BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_BASE_URL}/buscar?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  });

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Preciso de um',
    url: SITE_BASE_URL,
    logo: `${SITE_BASE_URL}/placeholder.svg`,
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: 'Portuguese',
    },
  });

  // Single unified hook for all feature flags (avoids 10+ re-render subscriptions)
  const {
    reviewsEnabled, featuredEnabled, popularSearchesEnabled, faqEnabled,
    blogEnabled, jobsEnabled, howItWorksEnabled, ctaEnabled,
    citiesEnabled, sponsorsEnabled, heroBannersEnabled,
    sectionsOrderRaw, hiddenSectionsRaw,
  } = useHomeFeatureFlags();

  const sectionOrder = useMemo(() => {
    const order = (sectionsOrderRaw || DEFAULT_ORDER).split(',').map(s => s.trim()).filter(Boolean);
    const hidden = new Set((hiddenSectionsRaw || '').split(',').map(s => s.trim()).filter(Boolean));
    return order.filter(s => !hidden.has(s));
  }, [sectionsOrderRaw, hiddenSectionsRaw]);

  const { data: categories = [], isLoading: catsLoading } = useCategoriesWithCount();
  const { data: featuredProviders = [], isLoading: provsLoading } = useFeaturedProviders();

  // Consolidated secondary data — single RPC call (replaces 4 parallel queries)
  const { data: secondaryData } = useQuery({
    queryKey: ['home-secondary-data'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_home_bootstrap');
      if (error) throw error;
      const payload = (data ?? {}) as {
        topCities?: Array<{ name: string; slug: string; state: string }>;
        sponsors?: Array<any>;
        counts?: { services?: number; jobs?: number };
      };
      return {
        topCities: payload.topCities ?? [],
        sponsors: payload.sponsors ?? [],
        counts: {
          services: payload.counts?.services ?? 0,
          jobs: payload.counts?.jobs ?? 0,
        },
      };
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const topCities = secondaryData?.topCities || [];
  const sponsors = secondaryData?.sponsors || [];
  const counts = secondaryData?.counts;

  // Section renderer — memoized to avoid re-creation each render
  const renderSection = useCallback((slug: string) => {
    switch (slug) {
      case 'cms_banners':
        return heroBannersEnabled ? <CmsBannersCarousel key={slug} /> : null;
      case 'urgency':
        return <UrgencyBanner key={slug} />;
      case 'leader_sponsor':
        return sponsorsEnabled ? <SponsorLeaderBanner key={slug} /> : null;
      case 'sponsor_top':
        return sponsorsEnabled ? <SponsorTopBanner key={slug} /> : null;
      case 'stats':
        return null;
      case 'highlights':
        return <HighlightsCarousel key={slug} />;
      case 'categories':
        return null; // rendered eagerly outside the loop to prevent CLS
      case 'pwa':
        return <PwaInstallSection key={slug} />;
      case 'dynamic':
        return <DynamicPageBlocks key={slug} pageSlug="home" city={geoCity || undefined} />;
      case 'home_featured_ad':
        return <SponsorAdSlot key={slug} locationKey="home-featured" layout="banner" />;
      case 'ad1':
        return (
          <div key={slug}>
            <AdBanner position="between-sections" className="container mx-auto px-4" />
            <AdSlot slotSlug="home-between" />
            <SponsorAdSlot locationKey="home-between" layout="banner" />
          </div>
        );
      case 'featured':
        return featuredEnabled ? <FeaturedProviders key={slug} providers={featuredProviders} isLoading={provsLoading} /> : null;
      case 'popular':
        return <PopularServices key={slug} />;
      case 'recent':
        return null;
      case 'ad2':
        return (
          <div key={slug}>
            <AdBanner position="mid-content" className="container mx-auto px-4" />
            <AdSlot slotSlug="home-mid" />
          </div>
        );
      case 'jobs':
        return jobsEnabled ? <FeaturedJobs key={slug} /> : null;
      case 'blog':
        return blogEnabled ? <BlogHighlight key={slug} /> : null;
      case 'courses':
        return <CoursesPromo key={slug} />;
      case 'cities':
        return null;
      case 'cta':
        return ctaEnabled ? <CtaSection key={slug} /> : null;
      case 'showcase':
        return <AdShowcase key={slug} />;
      case 'sponsors':
        return sponsorsEnabled ? <SponsorsSection key={slug} /> : null;
      case 'howitworks':
        return howItWorksEnabled ? <HowItWorksSection key={slug} /> : null;
      case 'searches':
        return popularSearchesEnabled ? <PopularSearches key={slug} /> : null;
      case 'testimonials':
        return reviewsEnabled ? <TestimonialsSection key={slug} /> : null;
      case 'faq':
        return faqEnabled ? <FaqSection key={slug} /> : null;
      case 'sponsor_cta':
        return sponsorsEnabled ? <SponsorFooterCTA key={slug} city={geoCity || undefined} /> : null;
      default:
        return null;
    }
  }, [
    heroBannersEnabled, sponsorsEnabled, featuredEnabled, jobsEnabled,
    blogEnabled, ctaEnabled, howItWorksEnabled, popularSearchesEnabled,
    reviewsEnabled, faqEnabled, categories, catsLoading,
    featuredProviders, provsLoading, geoCity,
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <HeroBanner />
      <DeferredAboveFoldSection>
        <Suspense fallback={<div className="h-8" />}><ActiveProvidersCounter /></Suspense>
      </DeferredAboveFoldSection>

      {/* Mural de Prova Social — Realtime (compacto, ~40% menor) */}
      <DeferredAboveFoldSection>
        <Suspense fallback={null}>
          <div className="container mx-auto px-4 mt-3 max-w-2xl">
            <CommunityFeed compact />
          </div>
        </Suspense>
      </DeferredAboveFoldSection>

      {/* Categories rendered eagerly (not lazy) to eliminate CLS caused by lazy sections above */}
      <CategoriesGrid categories={categories} isLoading={catsLoading} />

      {sectionOrder.map((slug) => {
        const section = renderSection(slug);
        if (!section) return null;
        return (
          <LazyErrorBoundary key={slug}>
            <LazyViewportSection>
              <Suspense fallback={<SectionFallback />}>
                {section}
              </Suspense>
            </LazyViewportSection>
          </LazyErrorBoundary>
        );
      })}
      <Footer />
    </div>
  );
};

export default Index;
