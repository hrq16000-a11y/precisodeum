import { lazy as reactLazy, Suspense, memo, Component, ReactNode, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureEnabled } from '@/hooks/useSiteSettings';
import { useCategoriesWithCount, useFeaturedProviders } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { importWithRetry } from '@/lib/lazyWithRetry';
import { useGeoCity } from '@/hooks/useGeoCity';

import Header from '@/components/Header';
import HeroBanner from '@/components/home/HeroBanner';
import CategoriesGrid from '@/components/home/CategoriesGrid';
import HighlightsCarousel from '@/components/home/HighlightsCarousel';
import FeaturedProviders from '@/components/home/FeaturedProviders';
import RecentServices from '@/components/home/RecentServices';
import PwaInstallSection from '@/components/home/PwaInstallSection';

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
const HowItWorksSection = lazy(() => import('@/components/home/HowItWorksSection'));
const TestimonialsSection = lazy(() => import('@/components/home/TestimonialsSection'));
const FaqSection = lazy(() => import('@/components/home/FaqSection'));
const PopularSearches = lazy(() => import('@/components/home/PopularSearches'));
const AdBanner = lazy(() => import('@/components/ads/AdBanner'));
const AdShowcase = lazy(() => import('@/components/ads/AdShowcase'));
const AdSlot = lazy(() => import('@/components/ads/AdSlot'));

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

const Index = () => {
  const { city: geoCity } = useGeoCity();
  const seoSuffix = geoCity ? ` em ${geoCity}` : '';

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

  const reviewsEnabled = useFeatureEnabled('reviews_enabled');
  const featuredEnabled = useFeatureEnabled('featured_providers_enabled');
  const popularSearchesEnabled = useFeatureEnabled('popular_searches_enabled');
  const faqEnabled = useFeatureEnabled('faq_enabled');
  const { data: categories = [], isLoading: catsLoading } = useCategoriesWithCount();
  const { data: featuredProviders = [], isLoading: provsLoading } = useFeaturedProviders();

  // Consolidated counts query (single request instead of two)
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

  // Consolidated secondary data (cities + categories for SEO + recent services + sponsors)
  const { data: secondaryData } = useQuery({
    queryKey: ['home-secondary-data'],
    queryFn: async () => {
      const [citiesRes, allCatsRes, recentRes, sponsorsRes] = await Promise.all([
        // Cities with services
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
        // All categories slugs
        supabase.from('categories').select('name, slug').order('name').then(r => r.data || []),
        // Recent services
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
        // Sponsors
        supabase.from('sponsors').select('id, title, image_url, link_url, tier, position, active, display_order').eq('active', true).order('display_order').then(r => r.data || []),
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

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <HeroBanner totalServices={counts?.services} totalJobs={counts?.jobs} />
      <CategoriesGrid categories={categories} isLoading={catsLoading} />
      <PwaInstallSection />
      <HighlightsCarousel />

      <LazyErrorBoundary>
        <Suspense fallback={<SectionFallback />}>
          <AdBanner position="between-sections" className="container mx-auto px-4" />
          <AdSlot slotSlug="home-between" />

          {featuredEnabled && (
            <FeaturedProviders providers={featuredProviders} isLoading={provsLoading} />
          )}
          <PopularServices />
          {recentServices.length > 0 && <RecentServices services={recentServices} />}

          <AdBanner position="mid-content" className="container mx-auto px-4" />
          <AdSlot slotSlug="home-mid" />

          <FeaturedJobs />
          <BlogHighlight />

          {topCities.length > 0 && <CitiesSection cities={topCities} />}
          <CtaSection />
          <AdShowcase />
          <SponsorsSection sponsors={sponsors} />
          <HowItWorksSection />
          {popularSearchesEnabled && allCategories.length > 0 && topCities.length > 0 && (
            <PopularSearches categories={allCategories} cities={topCities} />
          )}
          {reviewsEnabled && <TestimonialsSection />}
          {faqEnabled && <FaqSection />}
          <Footer />
          <FloatingWhatsApp />
        </Suspense>
      </LazyErrorBoundary>
    </div>
  );
};

export default Index;
