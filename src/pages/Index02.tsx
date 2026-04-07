/**
 * Index02 — Página de backup congelada (snapshot estático)
 * Estrutura fixa, não depende de feature flags, site_settings ou ordem dinâmica.
 * Última atualização do snapshot: 2026-04-07
 */
import { lazy as reactLazy, Suspense, Component, ReactNode, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCategoriesWithCount, useFeaturedProviders } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { importWithRetry } from '@/lib/lazyWithRetry';

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
const Footer = lazy(() => import('@/components/Footer'));
const FloatingWhatsApp = lazy(() => import('@/components/FloatingWhatsApp'));

class LazyErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? null : this.props.children; }
}

/**
 * FROZEN PAGE — Ordem fixa das seções, sem leitura de site_settings.
 * Para alterar a home principal, edite Index.tsx.
 */
const Index02 = () => {
  useSeoHead({
    title: 'Preciso de um | Encontre profissionais confiáveis perto de você',
    description: 'Marketplace de serviços profissionais. Encontre eletricistas, encanadores, técnicos e muito mais na sua cidade. Cadastre-se gratuitamente.',
    canonical: `${SITE_BASE_URL}/index02`,
  });

  const { data: categories = [], isLoading: catsLoading } = useCategoriesWithCount();
  const { data: featuredProviders = [], isLoading: provsLoading } = useFeaturedProviders();

  const { data: counts } = useQuery({
    queryKey: ['index02-counts'],
    queryFn: async () => {
      const [servicesRes, jobsRes] = await Promise.all([
        supabase.from('services').select('id', { count: 'exact', head: true }),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);
      return { services: servicesRes.count || 0, jobs: jobsRes.count || 0 };
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: secondaryData } = useQuery({
    queryKey: ['index02-secondary'],
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
          return [...(cities || [])].sort(() => Math.random() - 0.5).slice(0, 6);
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
      return { topCities: citiesRes, allCategories: allCatsRes, recentServices: recentRes, sponsors: sponsorsRes };
    },
    staleTime: 1000 * 60 * 10,
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
        <Suspense fallback={null}>
          <FeaturedProviders providers={featuredProviders} isLoading={provsLoading} />
          <PopularServices />
          {recentServices.length > 0 && <RecentServices services={recentServices} />}
          <FeaturedJobs />
          <BlogHighlight />
          {topCities.length > 0 && <CitiesSection cities={topCities} />}
          <CtaSection />
          <SponsorsSection sponsors={sponsors} />
          <HowItWorksSection />
          {allCategories.length > 0 && topCities.length > 0 && (
            <PopularSearches />
          )}
          <TestimonialsSection />
          <FaqSection />
          <Footer />
          <FloatingWhatsApp />
        </Suspense>
      </LazyErrorBoundary>
    </div>
  );
};

export default Index02;
