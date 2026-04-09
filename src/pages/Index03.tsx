import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCategoriesWithCount, useFeaturedProviders } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useGeoCity } from '@/hooks/useGeoCity';

import Header from '@/components/Header';
import PageTransition from '@/components/PageTransition';
import HeroBanner from '@/components/home/HeroBanner';
import UrgencyBanner from '@/components/home/UrgencyBanner';
import HighlightsCarousel from '@/components/home/HighlightsCarousel';
import CategoriesGrid from '@/components/home/CategoriesGrid';
import FeaturedProviders from '@/components/home/FeaturedProviders';
import RecentServices from '@/components/home/RecentServices';
import PwaInstallSection from '@/components/home/PwaInstallSection';
import DynamicPageBlocks from '@/components/DynamicPageBlocks';
import StatsCounter from '@/components/home/StatsCounter';
import PopularServices from '@/components/home/PopularServices';
import FeaturedJobs from '@/components/home/FeaturedJobs';
import BlogHighlight from '@/components/home/BlogHighlight';
import CitiesSection from '@/components/home/CitiesSection';
import CtaSection from '@/components/home/CtaSection';
import SponsorsSection from '@/components/home/SponsorsSection';
import SponsorLeaderBanner from '@/components/sponsors/SponsorLeaderBanner';
import HowItWorksSection from '@/components/home/HowItWorksSection';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import FaqSection from '@/components/home/FaqSection';
import PopularSearches from '@/components/home/PopularSearches';
import AdBanner from '@/components/ads/AdBanner';
import AdShowcase from '@/components/ads/AdShowcase';
import AdSlot from '@/components/ads/AdSlot';
import SponsorTopBanner from '@/components/sponsors/SponsorTopBanner';
import SponsorFooterCTA from '@/components/sponsors/SponsorFooterCTA';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';

/**
 * Index03 — Página backup/clone estática da home.
 * Todas as seções são sempre visíveis (sem feature flags).
 * Ordem fixa hardcoded. Cache keys exclusivas (index03-*).
 * NÃO ATUALIZAR — serve apenas para visualização de debug.
 */
const Index03 = () => {
  const { city: geoCity } = useGeoCity();

  useSeoHead({
    title: 'Backup Home pg03 | Preciso de um',
    description: 'Página de backup estática da home — todas as seções visíveis.',
    canonical: `${SITE_BASE_URL}/pg03`,
  });

  const { data: categories = [], isLoading: catsLoading } = useCategoriesWithCount();
  const { data: featuredProviders = [], isLoading: provsLoading } = useFeaturedProviders();

  const { data: counts } = useQuery({
    queryKey: ['index03-home-counts'],
    queryFn: async () => {
      const [servicesRes, jobsRes] = await Promise.all([
        supabase.from('services').select('id', { count: 'exact', head: true }),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);
      return { services: servicesRes.count || 0, jobs: jobsRes.count || 0 };
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: sponsors = [] } = useQuery({
    queryKey: ['index03-sponsors'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsors')
        .select('id, title, company_name, image_url, logo_url, link_url, tier, position, active, display_order, short_description, max_width, max_height')
        .eq('active', true)
        .order('display_order');
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: recentServices = [] } = useQuery({
    queryKey: ['index03-recent-services'],
    queryFn: async () => {
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
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: topCities = [] } = useQuery({
    queryKey: ['index03-cities'],
    queryFn: async () => {
      const { data: services } = await supabase.from('services').select('provider_id');
      if (!services || services.length === 0) return [];
      const providerIds = [...new Set(services.map((s: any) => s.provider_id))];
      const { data: providers } = await supabase.from('providers').select('city').in('id', providerIds);
      if (!providers) return [];
      const cityNames = [...new Set(providers.map((p: any) => p.city).filter(Boolean))];
      const { data: cities } = await supabase.from('cities').select('name, slug, state').in('name', cityNames);
      return (cities || []).slice(0, 6);
    },
    staleTime: 1000 * 60 * 5,
  });

  const heroTopSponsors = sponsors.filter((s: any) => s.position === 'hero-top' && (s.image_url || s.logo_url));

  return (
    <PageTransition>
      <div className="flex min-h-screen flex-col">
        <Header />
        <HeroBanner />

        <Suspense fallback={null}>
          {/* Urgency — sempre visível */}
          <UrgencyBanner />

          {/* Leader Sponsor */}
          {heroTopSponsors.length > 0 && <LeaderSponsor sponsors={heroTopSponsors as any} />}

          {/* Sponsor Top Banner */}
          <SponsorTopBanner />

          {/* Stats */}
          <StatsCounter />

          {/* Highlights */}
          <HighlightsCarousel />

          {/* Categories */}
          <CategoriesGrid categories={categories} isLoading={catsLoading} />

          {/* PWA Install */}
          <PwaInstallSection />

          {/* Dynamic Blocks */}
          <DynamicPageBlocks pageSlug="home" city={geoCity || undefined} />

          {/* Ad 1 */}
          <AdBanner position="between-sections" className="container mx-auto px-4" />
          <AdSlot slotSlug="home-between" />

          {/* Featured Providers */}
          <FeaturedProviders providers={featuredProviders} isLoading={provsLoading} />

          {/* Popular Services */}
          <PopularServices />

          {/* Recent Services */}
          <RecentServices services={recentServices} />

          {/* Ad 2 */}
          <AdBanner position="mid-content" className="container mx-auto px-4" />
          <AdSlot slotSlug="home-mid" />

          {/* Jobs */}
          <FeaturedJobs />

          {/* Blog */}
          <BlogHighlight />

          {/* Cities */}
          <CitiesSection cities={topCities} />

          {/* CTA */}
          <CtaSection />

          {/* Ad Showcase */}
          <AdShowcase />

          {/* Sponsors */}
          <SponsorsSection />

          {/* How It Works */}
          <HowItWorksSection />

          {/* Popular Searches */}
          <PopularSearches />

          {/* Testimonials */}
          <TestimonialsSection />

          {/* FAQ */}
          <FaqSection />

          {/* Sponsor Footer CTA */}
          <SponsorFooterCTA city={geoCity || undefined} />

          <Footer />
          <FloatingWhatsApp />
        </Suspense>
      </div>
    </PageTransition>
  );
};

export default Index03;
