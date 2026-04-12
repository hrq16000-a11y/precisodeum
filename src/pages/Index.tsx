import { lazy as reactLazy, Suspense, memo, Component, ReactNode, type ComponentType, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHomeFeatureFlags } from '@/hooks/useHomeFeatureFlags';
import { useCategoriesWithCount, useFeaturedProviders } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { importWithRetry } from '@/lib/lazyWithRetry';
import { useGeoCity } from '@/hooks/useGeoCity';

// Critical path — eagerly loaded
import Header from '@/components/Header';
import HeroBanner from '@/components/home/HeroBanner';

type LazyModule<T extends ComponentType<any>> = { default: T };
const lazy = <T extends ComponentType<any>>(importer: () => Promise<LazyModule<T>>) =>
  reactLazy(() => importWithRetry(importer));

// Lazy load all non-critical sections
const UrgencyBanner = lazy(() => import('@/components/home/UrgencyBanner'));
const CategoriesGrid = lazy(() => import('@/components/home/CategoriesGrid'));
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
const SponsorTopBanner = lazy(() => import('@/components/sponsors/SponsorTopBanner'));
const SponsorFooterCTA = lazy(() => import('@/components/sponsors/SponsorFooterCTA'));
const CmsBannersCarousel = lazy(() => import('@/components/home/CmsBannersCarousel'));
const CoursesPromo = lazy(() => import('@/components/home/CoursesPromo'));

const Footer = lazy(() => import('@/components/Footer'));
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
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Minimal height placeholder to prevent CLS from lazy sections
const SECTION_MIN_HEIGHTS: Record<string, string> = {
  categories: 'min-h-[280px]',
  stats: 'min-h-[177px]',
  highlights: 'min-h-[200px]',
  featured: 'min-h-[340px]',
  popular: 'min-h-[280px]',
  urgency: 'min-h-[48px]',
  leader_sponsor: 'min-h-[200px]',
  sponsor_top: 'min-h-[80px]',
};

const SectionFallback = ({ slug }: { slug?: string }) => {
  const h = slug ? SECTION_MIN_HEIGHTS[slug] : undefined;
  return h ? <div className={h} /> : null;
};

// Default section order
const DEFAULT_ORDER = 'cms_banners,urgency,leader_sponsor,sponsor_top,highlights,stats,categories,pwa,dynamic,ad1,featured,popular,ad2,jobs,courses,blog,cities,cta,showcase,sponsors,howitworks,searches,testimonials,faq,sponsor_cta';

const Index = () => {
  const { city: geoCity } = useGeoCity();

  useSeoHead({
    title: geoCity
      ? `Profissionais confiáveis em ${geoCity} | Preciso de um`
      : 'Preciso de um | Encontre profissionais confiáveis perto de você',
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

  // Consolidated secondary data — fires in parallel (no waterfall)
  const { data: secondaryData } = useQuery({
    queryKey: ['home-secondary-data'],
    queryFn: async () => {
      const [citiesRes, allCatsRes, sponsorsRes, servicesRes, jobsRes] = await Promise.all([
        supabase.from('cities').select('name, slug, state').eq('has_providers', true).order('provider_count', { ascending: false }).limit(6).then(r => r.data || []),
        supabase.from('categories').select('name, slug').order('name').then(r => r.data || []),
        supabase.from('sponsors').select('id, title, company_name, image_url, logo_url, link_url, tier, position, active, display_order, short_description, max_width, max_height').eq('active', true).order('display_order').then(r => r.data || []),
        supabase.from('services').select('id', { count: 'exact', head: true }),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);
      return {
        topCities: citiesRes,
        allCategories: allCatsRes,
        recentServices: [] as any[],
        sponsors: sponsorsRes,
        counts: {
          services: servicesRes.count || 0,
          jobs: jobsRes.count || 0,
        },
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  const topCities = secondaryData?.topCities || [];
  const allCategories = secondaryData?.allCategories || [];
  const recentServices = secondaryData?.recentServices || [];
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
        return <CategoriesGrid key={slug} categories={categories} isLoading={catsLoading} />;
      case 'pwa':
        return <PwaInstallSection key={slug} />;
      case 'dynamic':
        return <DynamicPageBlocks key={slug} pageSlug="home" city={geoCity || undefined} />;
      case 'ad1':
        return (
          <div key={slug}>
            <AdBanner position="between-sections" className="container mx-auto px-4" />
            <AdSlot slotSlug="home-between" />
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
      <Suspense fallback={null}><ActiveProvidersCounter /></Suspense>

      {sectionOrder.map((slug, i) => {
        const section = renderSection(slug);
        if (!section) return null;
        // Apply content-visibility to sections below the fold (index >= 3)
        // Use section-specific intrinsic heights to minimise CLS
        const sectionHeights: Record<string, string> = {
          categories: '0 1000px',
          featured: '0 600px',
          popular: '0 500px',
          howitworks: '0 450px',
          testimonials: '0 500px',
          faq: '0 600px',
          highlights: '0 350px',
          jobs: '0 450px',
          blog: '0 450px',
          courses: '0 400px',
          cta: '0 300px',
          pwa: '0 300px',
          sponsors: '0 250px',
          searches: '0 300px',
          showcase: '0 400px',
        };
        const cvStyle = i >= 3 ? { contentVisibility: 'auto' as const, containIntrinsicSize: sectionHeights[slug] || '0 400px' } : undefined;
        return (
          <LazyErrorBoundary key={slug}>
            <Suspense fallback={<SectionFallback slug={slug} />}>
              <div style={cvStyle}>{section}</div>
            </Suspense>
          </LazyErrorBoundary>
        );
      })}
      <LazyErrorBoundary>
        <Suspense fallback={<SectionFallback />}>
          <Footer />
        </Suspense>
      </LazyErrorBoundary>
    </div>
  );
};

export default Index;
