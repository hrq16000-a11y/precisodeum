import { useState, useMemo, lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, ArrowLeft, Users, Sparkles, Star, ArrowRight, Building2, Phone } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import PaginationControls from '@/components/PaginationControls';
import SearchBar from '@/components/SearchBar';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { motion } from 'framer-motion';

const SponsorLeaderBanner = lazy(() => import('@/components/sponsors/SponsorLeaderBanner'));
const SponsorFooterCTA = lazy(() => import('@/components/sponsors/SponsorFooterCTA'));

const STATE_NAMES: Record<string, string> = {
  ac: 'Acre', al: 'Alagoas', am: 'Amazonas', ap: 'Amapá',
  ba: 'Bahia', ce: 'Ceará', df: 'Distrito Federal', es: 'Espírito Santo',
  go: 'Goiás', ma: 'Maranhão', mg: 'Minas Gerais', ms: 'Mato Grosso do Sul',
  mt: 'Mato Grosso', pa: 'Pará', pb: 'Paraíba', pe: 'Pernambuco',
  pi: 'Piauí', pr: 'Paraná', rj: 'Rio de Janeiro', rn: 'Rio Grande do Norte',
  ro: 'Rondônia', rr: 'Roraima', rs: 'Rio Grande do Sul', sc: 'Santa Catarina',
  se: 'Sergipe', sp: 'São Paulo', to: 'Tocantins',
};

const ITEMS_PER_PAGE = 12;

type DensityLevel = 'empty' | 'low' | 'medium' | 'high';

function getDensity(count: number): DensityLevel {
  if (count === 0) return 'empty';
  if (count <= 3) return 'low';
  if (count <= 10) return 'medium';
  return 'high';
}

const CityDetailPage = () => {
  const { estado, cidade } = useParams<{ estado: string; cidade: string }>();
  const uf = (estado || '').toUpperCase();
  const stateName = STATE_NAMES[estado?.toLowerCase() || ''] || uf;
  const [page, setPage] = useState(1);

  // Fetch city + providers
  const { data, isLoading } = useQuery({
    queryKey: ['city-detail', estado, cidade],
    queryFn: async () => {
      // Find city by slug + state
      const { data: cities } = await supabase
        .from('cities')
        .select('*')
        .eq('slug', cidade)
        .eq('state_uf', uf)
        .limit(1);

      const city = cities?.[0];
      if (!city) {
        // Fallback: try slug only
        const { data: fallback } = await supabase
          .from('cities')
          .select('*')
          .eq('slug', cidade)
          .limit(1);
        if (!fallback?.[0]) return null;
        return { city: fallback[0], providers: [], categories: [] };
      }

      // Fetch providers
      const { data: provs } = await supabase
        .from('providers')
        .select('*, categories(name, slug, icon)')
        .eq('status', 'approved')
        .is('deleted_at', null)
        .ilike('city', city.name)
        .order('featured', { ascending: false })
        .order('rating_avg', { ascending: false })
        .limit(100);

      // Get profile names
      const userIds = [...new Set((provs || []).map(p => p.user_id))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        (profiles || []).forEach(p => { profileMap[p.id] = p.full_name; });
      }

      const providers = (provs || []).map(p => ({
        id: p.id,
        name: profileMap[p.user_id] || p.business_name || 'Profissional',
        businessName: p.business_name || undefined,
        category: (p.categories as any)?.name || '',
        categorySlug: (p.categories as any)?.slug || '',
        categoryIcon: (p.categories as any)?.icon || '🔧',
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
      }));

      // Unique categories from providers
      const catMap = new Map<string, { name: string; slug: string; icon: string }>();
      (provs || []).forEach(p => {
        const cat = p.categories as any;
        if (cat?.slug) catMap.set(cat.slug, { name: cat.name, slug: cat.slug, icon: cat.icon || '🔧' });
      });

      return { city, providers, categories: Array.from(catMap.values()) };
    },
    enabled: !!cidade,
    staleTime: 1000 * 60 * 5,
  });

  // Nearby cities (same state, different slug)
  const { data: nearbyCities = [] } = useQuery({
    queryKey: ['nearby-cities', uf, cidade],
    queryFn: async () => {
      const { data } = await supabase
        .from('cities')
        .select('name, slug, state_uf, provider_count')
        .eq('state_uf', uf)
        .neq('slug', cidade)
        .order('provider_count', { ascending: false })
        .limit(8);
      return data || [];
    },
    enabled: !!uf && !!cidade,
    staleTime: 1000 * 60 * 10,
  });

  const city = data?.city;
  const providers = data?.providers || [];
  const categories = data?.categories || [];
  const density = getDensity(providers.length);
  const paginatedProviders = providers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // SEO
  useSeoHead({
    title: city ? `Profissionais em ${city.name}, ${stateName}` : 'Cidade',
    description: city
      ? providers.length > 0
        ? `${providers.length} profissionais em ${city.name}, ${stateName}. Compare avaliações, veja portfólios e contrate.`
        : `Cadastre-se como profissional em ${city.name}, ${stateName}. Seja o primeiro na sua região!`
      : 'Encontre profissionais na sua cidade.',
    canonical: city ? `${SITE_BASE_URL}/cidades/${estado}/${cidade}` : undefined,
  });

  // JSON-LD
  const jsonLd = useMemo(() => {
    if (!city) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'City',
      name: city.name,
      containedInPlace: {
        '@type': 'State',
        name: stateName,
        containedInPlace: { '@type': 'Country', name: 'Brazil' },
      },
      ...(providers.length > 0 && {
        makesOffer: providers.slice(0, 5).map(p => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: p.category || 'Serviço profissional',
            provider: {
              '@type': 'LocalBusiness',
              name: p.name,
              address: { '@type': 'PostalAddress', addressLocality: city.name, addressRegion: stateName },
              ...(p.rating > 0 && {
                aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviewCount },
              }),
            },
          },
        })),
      }),
    };
  }, [city, providers, stateName]);
  useJsonLd(jsonLd);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
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
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <div className="container flex flex-1 items-center justify-center py-20 text-center">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Cidade não encontrada</h1>
            <p className="mt-2 text-muted-foreground">A cidade que você procura não está cadastrada.</p>
            <Button className="mt-4 rounded-full" asChild>
              <Link to={`/cidades/${estado}`}>Ver cidades de {stateName}</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {/* Breadcrumbs */}
      <div className="container py-3">
        <Breadcrumbs items={[
          { label: 'Cidades', url: '/cidades' },
          { label: stateName, url: `/cidades/${estado}` },
          { label: city!.name },
        ]} />
      </div>

      {/* Hero — density-aware */}
      <section className="relative overflow-hidden bg-primary py-12 md:py-16">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-white/5" />
        <div className="container relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl text-center">
            {density === 'empty' && (
              <>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/20 px-4 py-2 text-xs font-bold text-accent">
                  <Sparkles className="h-3.5 w-3.5" /> Oportunidade
                </div>
                <h1 className="font-display text-2xl font-bold text-white md:text-4xl">
                  Seja o primeiro profissional em{' '}
                  <span className="text-accent">{city!.name}</span>
                </h1>
                <p className="mt-3 text-white/70">
                  {city!.name}, {stateName} ainda não tem profissionais cadastrados.
                  Garanta sua posição de destaque gratuitamente!
                </p>
                <Button size="lg" className="mt-6 rounded-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-xl" asChild>
                  <Link to="/cadastro"><Sparkles className="h-4 w-4" /> Cadastrar agora — é grátis</Link>
                </Button>
              </>
            )}

            {density === 'low' && (
              <>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-yellow-500/20 px-4 py-2 text-xs font-bold text-yellow-300">
                  <Users className="h-3.5 w-3.5" /> Poucos profissionais
                </div>
                <h1 className="font-display text-2xl font-bold text-white md:text-4xl">
                  Profissionais em <span className="text-accent">{city!.name}</span>
                </h1>
                <p className="mt-3 text-white/70">
                  Ainda temos poucos profissionais em {city!.name}. 
                  Cadastre-se agora e destaque-se com menos concorrência!
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button size="lg" className="rounded-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
                    <Link to="/cadastro"><Sparkles className="h-4 w-4" /> Cadastrar e se destacar</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="rounded-full gap-2 border-white/40 text-white hover:bg-white/10" asChild>
                    <Link to="/buscar"><Search className="h-4 w-4" /> Ver profissionais</Link>
                  </Button>
                </div>
              </>
            )}

            {(density === 'medium' || density === 'high') && (
              <>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white">
                  <Users className="h-3.5 w-3.5" /> {providers.length} profissionais ativos
                </div>
                <h1 className="font-display text-2xl font-bold text-white md:text-4xl">
                  Profissionais em <span className="text-accent">{city!.name}</span>, {stateName}
                </h1>
                <p className="mt-3 text-white/70">
                  Compare avaliações, veja portfólios e contrate o melhor profissional da região.
                </p>
                <div className="mx-auto mt-6 max-w-lg">
                  <SearchBar variant="compact" />
                </div>
              </>
            )}
          </motion.div>
        </div>
      </section>

      <Suspense fallback={null}><SponsorLeaderBanner /></Suspense>

      {/* Providers listing */}
      {providers.length > 0 && (
        <div className="container py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Star className="h-5 w-5 text-accent" />
              {density === 'high' ? 'Melhores profissionais' : 'Profissionais disponíveis'}
            </h2>
            <span className="text-sm text-muted-foreground">{providers.length} resultado(s)</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedProviders.map(p => <ProviderCard key={p.id} provider={p} />)}
          </div>
          <PaginationControls currentPage={page} totalItems={providers.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />
        </div>
      )}

      {/* Categories available */}
      {categories.length > 0 && (
        <section className="border-t border-border bg-muted/30 py-10">
          <div className="container">
            <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Categorias em {city!.name}
            </h2>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <Link
                  key={cat.slug}
                  to={`/categoria/${cat.slug}`}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {cat.icon} {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Nearby cities — interlinking */}
      {nearbyCities.length > 0 && (
        <section className="border-t border-border py-10">
          <div className="container">
            <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-accent" />
              Cidades próximas em {stateName}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {nearbyCities.map(nc => (
                <Link
                  key={nc.slug}
                  to={`/cidades/${estado}/${nc.slug}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm transition-all hover:border-primary/40 hover:shadow-sm group"
                >
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">{nc.name}</span>
                  {(nc as any).provider_count > 0 ? (
                    <span className="text-xs text-accent font-semibold shrink-0 ml-2">{(nc as any).provider_count}</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">Seja o 1°</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Dynamic SEO text */}
      <section className="border-t border-border bg-muted/50 py-10">
        <div className="container max-w-3xl">
          <h2 className="font-display text-lg font-bold text-foreground mb-3">
            Sobre serviços profissionais em {city!.name}
          </h2>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {density === 'empty' ? (
              <>
                <p>
                  {city!.name} é uma cidade do estado de {stateName} que ainda não possui profissionais cadastrados
                  na plataforma Preciso de um. Esta é uma excelente oportunidade para prestadores de serviço
                  que desejam ser referência na região.
                </p>
                <p>
                  Ao se cadastrar como o primeiro profissional de {city!.name}, você garante destaque total
                  em todas as buscas da região, além de aparecer em destaque no ranking local.
                </p>
              </>
            ) : density === 'low' ? (
              <>
                <p>
                  {city!.name}, {stateName} conta com {providers.length} profissional(is) cadastrado(s).
                  A demanda por serviços na região está crescendo, e há espaço para novos prestadores
                  se destacarem com menos concorrência.
                </p>
                <p>
                  {categories.length > 0
                    ? `Os serviços disponíveis incluem ${categories.map(c => c.name).join(', ')}.`
                    : 'Diversas categorias de serviço estão disponíveis para cadastro.'}
                </p>
              </>
            ) : (
              <>
                <p>
                  {city!.name}, {stateName} é um mercado ativo com {providers.length} profissionais cadastrados
                  e avaliados por clientes reais. Compare portfólios, avaliações e experiência para encontrar
                  o melhor profissional para o seu projeto.
                </p>
                <p>
                  {categories.length > 0
                    ? `As categorias mais procuradas são: ${categories.slice(0, 5).map(c => c.name).join(', ')}.`
                    : 'Diversos serviços profissionais estão disponíveis na região.'}
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-border bg-card py-12">
        <div className="container text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-accent" />
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            {density === 'empty'
              ? `Seja o pioneiro em ${city!.name}`
              : density === 'low'
                ? `${city!.name} precisa de mais profissionais`
                : `Ofereça seus serviços em ${city!.name}`}
          </h2>
          <p className="mt-2 text-muted-foreground max-w-md mx-auto">
            Cadastro gratuito, perfil completo com portfólio e avaliações verificadas.
          </p>
          <Button size="lg" className="mt-5 rounded-full gap-2" asChild>
            <Link to="/cadastro">Cadastrar agora <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <Suspense fallback={null}><SponsorFooterCTA city={city!.name} /></Suspense>
      <Footer />
    </div>
  );
};

export default CityDetailPage;
