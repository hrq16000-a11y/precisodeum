import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, DollarSign, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PopularServicePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [aiContent, setAiContent] = useState<{ title?: string; description?: string; tips?: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: service, isLoading: serviceLoading } = useQuery({
    queryKey: ['popular-service', slug],
    queryFn: async () => {
      const { data } = await supabase
        .from('popular_services' as any)
        .select('*')
        .eq('slug', slug)
        .eq('active', true)
        .single();
      return data as any;
    },
    enabled: !!slug,
  });

  // Fetch AI content
  useQuery({
    queryKey: ['service-ai-content', slug],
    queryFn: async () => {
      if (!service) return null;
      setAiLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('generate-service-content', {
          body: { serviceName: service.name, categoryName: service.category_name },
        });
        if (!error && data) {
          setAiContent(data);
        }
      } catch {
        // Silently fail - AI content is supplementary
      } finally {
        setAiLoading(false);
      }
      return null;
    },
    enabled: !!service,
    staleTime: 1000 * 60 * 30,
  });

  const { data: providers = [], isLoading: provsLoading } = useQuery({
    queryKey: ['providers-for-service', service?.category_slug],
    queryFn: async () => {
      if (!service?.category_slug) return [];
      const { data: cats } = await supabase.from('categories').select('id').eq('slug', service.category_slug);
      if (!cats?.length) return [];
      const catId = cats[0].id;
      const { data } = await supabase
        .from('providers')
        .select('*, categories(name, slug, icon)')
        .eq('category_id', catId)
        .eq('status', 'approved')
        .order('rating_avg', { ascending: false })
        .limit(12);
      if (!data) return [];
      const userIds = [...new Set(data.map((p: any) => p.user_id))];
      const { data: profiles } = await supabase.from('public_profiles' as any).select('id, full_name, avatar_url').in('id', userIds);
      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
      return data.map((p: any) => {
        const profile = profileMap[p.user_id];
        const cat = p.categories as any;
        return {
          id: p.id,
          name: profile?.full_name || p.business_name || 'Profissional',
          businessName: p.business_name,
          category: cat?.name || '',
          categorySlug: cat?.slug || '',
          categoryIcon: cat?.icon || '🔧',
          city: p.city, state: p.state, neighborhood: p.neighborhood,
          rating: Number(p.rating_avg), reviewCount: p.review_count,
          photo: p.photo_url || profile?.avatar_url || '',
          description: p.description, phone: p.phone, whatsapp: p.whatsapp,
          yearsExperience: p.years_experience, plan: p.plan,
          services: [], reviews: [], slug: p.slug || p.id, featured: p.featured,
        };
      });
    },
    enabled: !!service?.category_slug,
  });

  const title = service ? `${service.name} - A partir de R$ ${Number(service.min_price).toFixed(2).replace('.', ',')}` : 'Carregando...';
  const desc = service?.description || '';

  useSeoHead({ title, description: desc, canonical: `${SITE_BASE_URL}/servico/${slug}` });
  useJsonLd(service ? {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    provider: { '@type': 'Organization', name: 'Preciso de um' },
    offers: { '@type': 'Offer', priceCurrency: 'BRL', price: service.min_price, priceSpecification: { '@type': 'UnitPriceSpecification', priceCurrency: 'BRL', price: service.min_price, unitText: 'A partir de' } },
  } : null);

  if (serviceLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-10"><div className="container"><Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-4 w-96" /></div></main>
        <Footer />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-20 text-center"><h1 className="text-2xl font-bold text-foreground">Serviço não encontrado</h1></main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary/10 to-accent/10 py-12">
          <div className="container">
            <nav className="mb-4 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-primary">Início</Link>
              <span className="mx-2">/</span>
              <span className="text-foreground">{service.name}</span>
            </nav>
            <div className="flex items-center gap-4">
              <span className="text-5xl">{service.icon}</span>
              <div>
                <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">{aiContent?.title || service.name}</h1>
                <p className="mt-2 text-muted-foreground max-w-xl">{aiContent?.description || service.description}</p>
                <div className="mt-3 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-accent" />
                  <span className="text-lg font-bold text-accent">
                    A partir de R$ {Number(service.min_price).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Tips */}
        {(aiContent?.tips?.length ?? 0) > 0 && (
          <section className="py-8 bg-accent/5">
            <div className="container">
              <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" /> Dicas importantes
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {aiContent!.tips!.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">{i + 1}</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
        {aiLoading && (
          <section className="py-6">
            <div className="container"><Skeleton className="h-24 rounded-xl" /></div>
          </section>
        )}

        {/* Providers */}
        <section className="py-12">
          <div className="container">
            <h2 className="font-display text-xl font-bold text-foreground mb-6">
              Profissionais de {service.name}
            </h2>
            {provsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
              </div>
            ) : providers.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {providers.map((p: any) => <ProviderCard key={p.id} provider={p} />)}
              </div>
            ) : (
              <div className="text-center py-12 rounded-xl border border-border bg-card">
                <p className="text-muted-foreground">Nenhum profissional encontrado para este serviço.</p>
                <Button variant="accent" className="mt-4" asChild>
                  <Link to="/buscar">Buscar profissionais <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PopularServicePage;
