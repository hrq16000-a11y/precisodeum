import { useState, useMemo, lazy, Suspense } from 'react';
import { normalize } from '@/lib/normalize';
import EmptyStateFallback from '@/components/EmptyStateFallback';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import PaginationControls from '@/components/PaginationControls';
import SearchBar from '@/components/SearchBar';
import Breadcrumbs from '@/components/Breadcrumbs';
import GeoLocationChip from '@/components/GeoLocationChip';
import GeoPromptBanner from '@/components/GeoPromptBanner';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useGeoCity } from '@/hooks/useGeoCity';
import { calculateDistanceKm } from '@/lib/geoDistance';
import { importWithRetry } from '@/lib/lazyWithRetry';

const SponsorLeaderBanner = lazy(() => importWithRetry(() => import('@/components/sponsors/SponsorLeaderBanner')));
const SponsorTopBanner = lazy(() => importWithRetry(() => import('@/components/sponsors/SponsorTopBanner')));
const SponsorFooterCTA = lazy(() => importWithRetry(() => import('@/components/sponsors/SponsorFooterCTA')));

const ITEMS_PER_PAGE = 12;

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) =>
  calculateDistanceKm({ latitude: lat1, longitude: lon1 }, { latitude: lat2, longitude: lon2 });

const compareCityMerit = (a: any, b: any) => {
  const levelDiff = (b.levelPriority || 0) - (a.levelPriority || 0);
  if (levelDiff !== 0) return levelDiff;
  const ratingDiff = (b.rating || 0) - (a.rating || 0);
  if (Math.abs(ratingDiff) > 0.001) return ratingDiff;
  const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (aCreated !== bCreated) return aCreated - bCreated;
  return (b.portfolioPhotoCount || 0) - (a.portfolioPhotoCount || 0);
};

const CityPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const { latitude: userLat, longitude: userLon } = useGeoCity();

  const { data, isLoading } = useQuery({
    queryKey: ['city-page', slug],
    queryFn: async () => {
      const { data: city } = await supabase
        .from('cities')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (!city) return null;

      const { data: provs } = await supabase
        .from('providers')
        .select('*, categories(name, slug, icon)')
        .eq('status', 'approved')
        .ilike('city', `%${city.name}%`)
        .order('rating_avg', { ascending: false });

      const userIds = [...new Set((provs || []).map((p) => p.user_id))];
      let profileMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, gamification_levels!profiles_level_id_fkey(name, priority)')
          .in('id', userIds) as { data: { id: string; full_name: string }[] | null };
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
      }

      const providers = (provs || []).map((p) => ({
        id: p.id,
        userId: p.user_id,
        createdAt: p.created_at || null,
        name: profileMap[p.user_id]?.full_name || p.business_name || 'Profissional',
        businessName: p.business_name || undefined,
        category: (p.categories as any)?.name || '',
        categorySlug: (p.categories as any)?.slug || '',
        categoryIcon: (p.categories as any)?.icon || 'Wrench',
        city: p.city,
        state: p.state,
        neighborhood: p.neighborhood,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        rating: Number(p.rating_avg) || 0,
        reviewCount: p.review_count || 0,
        photo: p.photo_url || '',
        description: p.description,
        phone: p.phone,
        whatsapp: p.whatsapp,
        yearsExperience: p.years_experience,
        plan: p.plan,
        slug: p.slug || p.id,
        featured: p.featured,
        servicesCount: p.services_count || 0,
        portfolioAlbumCount: p.portfolio_album_count || 0,
        portfolioPhotoCount: p.portfolio_photo_count || 0,
        levelName: (Array.isArray(profileMap[p.user_id]?.gamification_levels) ? profileMap[p.user_id]?.gamification_levels?.[0]?.name : profileMap[p.user_id]?.gamification_levels?.name) || null,
        levelPriority: (Array.isArray(profileMap[p.user_id]?.gamification_levels) ? profileMap[p.user_id]?.gamification_levels?.[0]?.priority : profileMap[p.user_id]?.gamification_levels?.priority) || 0,
      }));

      return { city, providers };
    },
    enabled: !!slug,
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories-for-links'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('name, slug').order('name');
      return data || [];
    },
  });

  const city = data?.city;
  const rawProviders = data?.providers || [];

  // Sort by GPS distance when available, attach distanceKm
  const providers = useMemo(() => {
    const cityNorm = city ? normalize(city.name) : '';
    const enriched = rawProviders.map((p) => {
      let dist: number | undefined;
      if (userLat != null && userLon != null && p.latitude != null && p.longitude != null) {
        dist = Math.round(haversine(userLat, userLon, p.latitude, p.longitude) * 10) / 10;
      }
      return { ...p, distanceKm: dist };
    });

    return enriched.sort((a, b) => {
      // Tier 1: same city as user always first
      if (cityNorm) {
        const aMatch = normalize(a.city || '') === cityNorm;
        const bMatch = normalize(b.city || '') === cityNorm;
        if (aMatch !== bMatch) return aMatch ? -1 : 1;
      }
      // Tier 2: distance
      if (userLat != null && userLon != null) {
        const dA = a.distanceKm ?? Infinity;
        const dB = b.distanceKm ?? Infinity;
        if (dA !== dB) return dA - dB;
      }
      return compareCityMerit(a, b);
    });
  }, [rawProviders, userLat, userLon, city]);

  useSeoHead({
    title: city ? `Profissionais em ${city.name} - ${city.state}` : 'Cidade',
    description: city
      ? `Encontre os melhores profissionais em ${city.name}, ${city.state}. ${providers.length} cadastrados com avaliações verificadas.`
      : 'Encontre profissionais na sua cidade.',
    canonical: slug ? `${SITE_BASE_URL}/cidade/${slug}` : undefined,
  });

  const cityAuthorityLd = useMemo(() => {
    if (!city) return null;
    const authorityProviders = providers.filter((p: any) => {
      const level = (p.levelName || '').toLowerCase();
      return level.includes('diamante') || level.includes('ouro');
    });
    const ratingSource = authorityProviders.length > 0 ? authorityProviders : providers;
    const ratings = ratingSource.map((p: any) => Number(p.rating || 0)).filter((r: number) => r > 0);
    return {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: `Profissionais em ${city.name}`,
      areaServed: { '@type': 'City', name: city.name },
      provider: { '@type': 'Organization', name: 'Preciso de um', url: SITE_BASE_URL },
      url: `${SITE_BASE_URL}/cidade/${slug}`,
      ...(ratings.length > 0 && {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1),
          reviewCount: ratingSource.reduce((acc: number, p: any) => acc + (Number(p.reviewCount) || 0), 0) || ratings.length,
          bestRating: 5,
          worstRating: 1,
        },
      }),
    };
  }, [city, providers, slug]);
  useJsonLd(cityAuthorityLd);

  const paginatedProviders = providers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container py-8">
          <Skeleton className="mb-4 h-10 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container flex flex-1 items-center justify-center py-20">
          <div className="text-center">
            <h1 className="font-display text-4xl font-bold text-foreground">Cidade não encontrada</h1>
            <p className="mt-2 text-muted-foreground">A cidade que você procura não está cadastrada.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const title = `Profissionais em ${city!.name} - ${city!.state}`;
  const description = `Encontre os melhores profissionais em ${city!.name}, ${city!.state}. Compare avaliações e entre em contato.`;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <div className="container py-3">
        <Breadcrumbs items={[
          { label: 'Cidades', url: '/cidades' },
          { label: city!.name },
        ]} />
      </div>

      <section className="bg-hero py-12">
        <div className="container text-center">
          <h1 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-primary-foreground/70">{description}</p>
          <div className="mx-auto mt-4">
            <GeoLocationChip />
          </div>
          <div className="mx-auto mt-4 max-w-2xl">
            <SearchBar variant="compact" />
          </div>
        </div>
      </section>

      <Suspense fallback={null}><SponsorLeaderBanner /></Suspense>
      <Suspense fallback={null}><SponsorTopBanner /></Suspense>

      <div className="container py-8">
        <GeoPromptBanner />

        <p className="mb-6 text-sm text-muted-foreground">
          {providers.length} profissional(is) encontrado(s) em {city!.name}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedProviders.map((p) => <ProviderCard key={p.id} provider={p as any} />)}
        </div>
        {providers.length === 0 && (
          <EmptyStateFallback
            title="Nenhum profissional encontrado"
            message={`Ainda não temos profissionais em ${city!.name}. Seja o primeiro!`}
          />
        )}
        <PaginationControls currentPage={page} totalItems={providers.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />
      </div>

      <section className="bg-muted/50 py-12">
        <div className="container max-w-4xl">
          <h2 className="font-display text-xl font-bold text-foreground">
            Serviços em {city!.name}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {allCategories.map((cat) => (
              <Link
                key={cat.slug}
                to={`/${cat.slug}-${city!.slug}`}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {cat.name} em {city!.name}
              </Link>
            ))}
          </div>
          <div className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Encontre um profissional para qualquer tipo de serviço em {city!.name}, {city!.state}.
              Nossa plataforma conecta você com os melhores prestadores de serviço da região,
              todos avaliados por clientes reais.
            </p>
          </div>
        </div>
      </section>

      <Suspense fallback={null}><SponsorFooterCTA city={city!.name} /></Suspense>

      <Footer />
    </div>
  );
};

export default CityPage;
