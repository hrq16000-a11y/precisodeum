import { lazy as reactLazy, Suspense, memo, Component, ReactNode, type ComponentType, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureEnabled, useSettingValue } from '@/hooks/useSiteSettings';
import { useCategoriesWithCount, useFeaturedProviders } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { importWithRetry } from '@/lib/lazyWithRetry';
import { useGeoCity } from '@/hooks/useGeoCity';

// Critical path — eagerly loaded
import Header from '@/components/Header';
import HeroBanner from '@/components/home/HeroBanner';

// Near-fold — lazy but high priority
import PageTransition from '@/components/PageTransition';

type LazyModule<T extends ComponentType<any>> = { default: T };
const lazy = <T extends ComponentType<any>>(importer: () => Promise<LazyModule<T>>) =>
  reactLazy(() => importWithRetry(importer));

// Lazy load below-the-fold sections
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

const Footer = lazy(() => import('@/components/Footer'));
const FloatingWhatsApp = lazy(() => import('@/components/FloatingWhatsApp'));

// Error boundary to prevent lazy load failures from crashing the page
class LazyErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? null : this.props.children; }
}

const SectionFallback = () => null;

// Default section order
const DEFAULT_ORDER = 'cms_banners,urgency,leader_sponsor,sponsor_top,highlights,stats,categories,pwa,dynamic,ad1,featured,popular,ad2,jobs,blog,cities,cta,showcase,sponsors,howitworks,searches,testimonials,faq,sponsor_cta';

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

  // Feature flags
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');
  const featuredEnabled = useFeatureEnabled('featured_providers_enabled');
  const popularSearchesEnabled = useFeatureEnabled('popular_searches_enabled');
  const faqEnabled = useFeatureEnabled('faq_enabled');
  const blogEnabled = useFeatureEnabled('module_blog');
  const jobsEnabled = useFeatureEnabled('module_jobs');
  const howItWorksEnabled = useFeatureEnabled('module_howitworks');
  const ctaEnabled = useFeatureEnabled('module_cta');
  const citiesEnabled = useFeatureEnabled('module_cities');
  const sponsorsEnabled = useFeatureEnabled('module_sponsors');
  const heroBannersEnabled = useFeatureEnabled('module_hero_banners');

  // Section order from admin
  const sectionsOrderRaw = useSettingValue('homepage_sections_order');
  const hiddenSectionsRaw = useSettingValue('homepage_hidden_sections');

  const sectionOrder = useMemo(() => {
    const order = (sectionsOrderRaw || DEFAULT_ORDER).split(',').map(s => s.trim()).filter(Boolean);
    const hidden = new Set((hiddenSectionsRaw || '').split(',').map(s => s.trim()).filter(Boolean));
    return order.filter(s => !hidden.has(s));
  }, [sectionsOrderRaw, hiddenSectionsRaw]);

  const { data: categories = [], isLoading: catsLoading } = useCategoriesWithCount();
  const { data: featuredProviders = [], isLoading: provsLoading } = useFeaturedProviders();

  // Consolidated counts query
  const { data: counts } = useQuery({
    queryKey: ['home-counts'],
    queryFn: async () => {
      const [servicesRes, jobsRes] = await Promise.all([
        supabase.from('services').select('id', { count: 'exact', head: true }),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);
      return {
        services: servicesRes.count || 0,
        jobs: jobsRes.count || 0,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // Consolidated secondary data
  const { data: secondaryData } = useQuery({
    queryKey: ['home-secondary-data'],
    queryFn: async () => {
      const [citiesRes, allCatsRes, recentRes, sponsorsRes] = await Promise.all([
        (async () => {
          const { data: services } = await supabase.from('services').select('provider_id');
          if (!services || services.length === 0) return [];
          const providerIds = [...new Set(services.map((s: any) => s.provider_id))];
          const { data: providers } = await supabase.from('providers').select('city').in('id', providerIds);
          if (!providers) return [];
          const cityNames = [...new Set(providers.map((p: any) => p.city).filter(Boolean))];
          const { data: cities } = await supabase.from('cities').select('name, slug, state').in('name', cityNames);
          const shuffled = [...(cities || [])].sort(() => Math.random() - 0.5);
          return shuffled.slice(0, 6);
        })(),
        supabase.from('categories').select('name, slug').order('name').then(r => r.data || []),
        (async () => {
          const { data } = await supabase
            .from('services')
            .select('id, service_name, service_area, created_at, provider_id, category_id, categories(name, slug, icon)')
            .order('created_at', { ascending: false })
            .limit(6);
          if (!data || data.length === 0) return [];
          const providerIds = [...new Set(data.map((s: any) => s.provider_id))];
          const { data: providers } = await supabase.from('providers').select('id, city, state').in('id', providerIds);
          const providerMap: Record<string, any> = {};
          (providers || []).forEach((p: any) => { providerMap[p.id] = p; });
          return data.map((s: any) => ({ ...s, provider: providerMap[s.provider_id] || null }));
        })(),
        supabase.from('sponsors').select('id, title, company_name, image_url, logo_url, link_url, tier, position, active, display_order, short_description, max_width, max_height').eq('active', true).order('display_order').then(r => r.data || []),
      ]);
      return {
        topCities: citiesRes,
        allCategories: allCatsRes,
        recentServices: recentRes,
        sponsors: sponsorsRes,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const topCities = secondaryData?.topCities || [];
  const allCategories = secondaryData?.allCategories || [];
  const recentServices = secondaryData?.recentServices || [];
  const sponsors = secondaryData?.sponsors || [];

  // Section renderer — maps slug to component
  const renderSection = (slug: string) => {
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
        return <StatsCounter key={slug} />;
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
        return null; // Moved to /servicos page
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
  };

  return (
    <PageTransition>
      <div className="flex min-h-screen flex-col">
        <Header />
        <HeroBanner />

        {sectionOrder.map(slug => {
          const section = renderSection(slug);
          if (!section) return null;
          return (
            <LazyErrorBoundary key={slug}>
              <Suspense fallback={<SectionFallback />}>
                {section}
              </Suspense>
            </LazyErrorBoundary>
          );
        })}
        <LazyErrorBoundary>
          <Suspense fallback={<SectionFallback />}>
            <Footer />
            <FloatingWhatsApp />
          </Suspense>
        </LazyErrorBoundary>
      </div>
    </PageTransition>
  );
};

export default Index;
