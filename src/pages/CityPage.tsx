import { useState } from 'react';
import EmptyStateFallback from '@/components/EmptyStateFallback';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import PaginationControls from '@/components/PaginationControls';
import SearchBar from '@/components/SearchBar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { ChevronRight } from 'lucide-react';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

const ITEMS_PER_PAGE = 12;

const CityPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);

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
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('public_profiles' as any)
          .select('id, full_name')
          .in('id', userIds) as { data: { id: string; full_name: string }[] | null };
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name; });
      }

      const providers = (provs || []).map((p) => ({
        id: p.id,
        name: profileMap[p.user_id] || p.business_name || 'Profissional',
        businessName: p.business_name || undefined,
        category: (p.categories as any)?.name || '',
        categorySlug: (p.categories as any)?.slug || '',
        categoryIcon: (p.categories as any)?.icon || '🔧',
        city: p.city,
        state: p.state,
        neighborhood: p.neighborhood,
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
  const providers = data?.providers || [];

  useSeoHead({
    title: city ? `Profissionais em ${city.name} - ${city.state}` : 'Cidade',
    description: city
      ? `Encontre os melhores profissionais em ${city.name}, ${city.state}. ${providers.length} cadastrados com avaliações verificadas.`
      : 'Encontre profissionais na sua cidade.',
    canonical: slug ? `${SITE_BASE_URL}/cidade/${slug}` : undefined,
  });

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

      <nav className="container py-3 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Início</Link>
        <ChevronRight className="mx-1 inline h-3 w-3" />
        <span className="text-foreground">{city!.name}</span>
      </nav>

      <section className="bg-hero py-12">
        <div className="container text-center">
          <h1 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-primary-foreground/70">{description}</p>
          <div className="mx-auto mt-6 max-w-2xl">
            <SearchBar variant="compact" />
          </div>
        </div>
      </section>

      <div className="container py-8">
        <p className="mb-6 text-sm text-muted-foreground">
          {providers.length} profissional(is) encontrado(s) em {city!.name}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedProviders.map((p) => <ProviderCard key={p.id} provider={p} />)}
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
              Encontre profissionais qualificados em {city!.name}, {city!.state}.
              Nossa plataforma conecta você com os melhores prestadores de serviço da região,
              todos avaliados por clientes reais.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CityPage;
