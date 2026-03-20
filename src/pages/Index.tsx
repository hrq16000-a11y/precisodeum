import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Users, Zap, ChevronDown, Clock, MapPin, Tag, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SearchBar from '@/components/SearchBar';
import ProviderCard from '@/components/ProviderCard';
import StarRating from '@/components/StarRating';
import { useFeatureEnabled } from '@/hooks/useSiteSettings';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoriesWithCount, useFeaturedProviders } from '@/hooks/useProviders';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { testimonials, howItWorks } from '@/data/mockData';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import heroImage from '@/assets/hero-image.jpg';

import HeroBanner from '@/components/home/HeroBanner';
import CategoriesGrid from '@/components/home/CategoriesGrid';
import FeaturedProviders from '@/components/home/FeaturedProviders';
import PopularServices from '@/components/home/PopularServices';
import RecentServices from '@/components/home/RecentServices';
import CitiesSection from '@/components/home/CitiesSection';
import CtaSection from '@/components/home/CtaSection';
import SponsorsSection from '@/components/home/SponsorsSection';
import HowItWorksSection from '@/components/home/HowItWorksSection';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import FaqSection from '@/components/home/FaqSection';
import PopularSearches from '@/components/home/PopularSearches';
import SponsorAd from '@/components/SponsorAd';
import HighlightsCarousel from '@/components/home/HighlightsCarousel';
import FeaturedJobs from '@/components/home/FeaturedJobs';

const Index = () => {
  useSeoHead({
    title: 'Preciso de um | Encontre profissionais confiáveis perto de você',
    description: 'Marketplace de serviços profissionais. Encontre eletricistas, encanadores, técnicos e muito mais na sua cidade. Cadastre-se gratuitamente.',
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

  const { data: totalServicesCount = 0 } = useQuery({
    queryKey: ['total-services-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: totalJobsCount = 0 } = useQuery({
    queryKey: ['total-jobs-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      return count || 0;
    },
  });

  // Cities with active services only
  const { data: topCities = [] } = useQuery({
    queryKey: ['top-cities-with-services'],
    queryFn: async () => {
      const { data: services } = await supabase.from('services').select('provider_id');
      if (!services || services.length === 0) return [];
      const providerIds = [...new Set(services.map((s: any) => s.provider_id))];
      const { data: providers } = await supabase.from('providers').select('city').in('id', providerIds);
      if (!providers) return [];
      const cityNames = [...new Set(providers.map((p: any) => p.city).filter(Boolean))];
      const { data: cities } = await supabase.from('cities').select('name, slug, state').in('name', cityNames);
      // Shuffle and return 4-6
      const shuffled = [...(cities || [])].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 6);
    },
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ['all-categories-slugs'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('name, slug').order('name');
      return data || [];
    },
  });

  const { data: recentServices = [] } = useQuery({
    queryKey: ['recent-services-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('services')
        .select('id, service_name, service_area, created_at, provider_id, category_id, categories(name, slug, icon)')
        .order('created_at', { ascending: false })
        .limit(6);
      if (!data || data.length === 0) return [];

      const providerIds = [...new Set(data.map((s: any) => s.provider_id))];
      const { data: providers } = await supabase
        .from('providers')
        .select('id, city, state')
        .in('id', providerIds);

      const providerMap: Record<string, any> = {};
      (providers || []).forEach((p: any) => {
        providerMap[p.id] = p;
      });

      return data.map((s: any) => ({
        ...s,
        provider: providerMap[s.provider_id] || null,
      }));
    },
  });

  const { data: sponsors = [] } = useQuery({
    queryKey: ['sponsors-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsors')
        .select('*')
        .eq('active', true)
        .order('display_order');
      return data || [];
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <HeroBanner totalServices={totalServicesCount} totalJobs={totalJobsCount} />
      <HighlightsCarousel />
      <CategoriesGrid categories={categories} isLoading={catsLoading} />
      <SponsorAd position="between-sections" />
      {featuredEnabled && (
        <FeaturedProviders providers={featuredProviders} isLoading={provsLoading} />
      )}
      <PopularServices />
      {recentServices.length > 0 && <RecentServices services={recentServices} />}
      <FeaturedJobs />
      <SponsorAd position="between-sections" />
      {topCities.length > 0 && <CitiesSection cities={topCities} />}
      <CtaSection />
      <SponsorsSection sponsors={sponsors} />
      <HowItWorksSection />
      {popularSearchesEnabled && allCategories.length > 0 && topCities.length > 0 && (
        <PopularSearches categories={allCategories} cities={topCities} />
      )}
      {reviewsEnabled && <TestimonialsSection />}
      {faqEnabled && <FaqSection />}
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};

export default Index;
