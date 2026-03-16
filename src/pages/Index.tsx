import { motion } from 'framer-motion';
import { ArrowRight, Shield, Users, Zap, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SearchBar from '@/components/SearchBar';
import CategoryCard from '@/components/CategoryCard';
import ProviderCard from '@/components/ProviderCard';
import StarRating from '@/components/StarRating';
import { useFeatureEnabled } from '@/hooks/useSiteSettings';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoriesWithCount, useFeaturedProviders } from '@/hooks/useProviders';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { testimonials, howItWorks } from '@/data/mockData';

const Index = () => {
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');
  const featuredEnabled = useFeatureEnabled('featured_providers_enabled');
  const popularSearchesEnabled = useFeatureEnabled('popular_searches_enabled');
  const faqEnabled = useFeatureEnabled('faq_enabled');
  const { data: categories = [], isLoading: catsLoading } = useCategoriesWithCount();
  const { data: featuredProviders = [], isLoading: provsLoading } = useFeaturedProviders();

  const { data: topCities = [] } = useQuery({
    queryKey: ['top-cities'],
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('name, slug, state').order('name').limit(12);
      return data || [];
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
        .select('id, service_name, description, price, service_area, created_at, provider_id, category_id, categories(name, slug, icon)')
        .order('created_at', { ascending: false })
        .limit(6);
      if (!data || data.length === 0) return [];

      const providerIds = [...new Set(data.map((s: any) => s.provider_id))];
      const { data: providers } = await supabase
        .from('providers')
        .select('id, business_name, user_id, city, state, slug, photo_url')
        .in('id', providerIds);

      const userIds = [...new Set((providers || []).map((p: any) => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name; });

      const providerMap: Record<string, any> = {};
      (providers || []).forEach((p: any) => {
        providerMap[p.id] = { ...p, name: profileMap[p.user_id] || p.business_name || 'Profissional' };
      });

      return data.map((s: any) => ({
        ...s,
        provider: providerMap[s.provider_id] || null,
        category: s.categories,
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

  const bannerSponsors = sponsors.filter((s: any) => s.position === 'banner');
  const cardSponsors = sponsors.filter((s: any) => s.position === 'card' || s.position === 'featured');

  // Show top 6 categories for the flat grid
  const topCategories = categories.slice(0, 6);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero – Clean Triider Style */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-accent/5 py-16 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.08),transparent_70%)]" />
        <div className="container relative z-10 flex flex-col items-center text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-3xl font-extrabold tracking-tight text-foreground md:text-5xl lg:text-6xl"
          >
            Encontre profissionais para{' '}
            <span className="text-accent">qualquer serviço</span>
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-8 w-full max-w-2xl"
          >
            <SearchBar />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-5 text-sm text-muted-foreground"
          >
            Cadastre seus serviços gratuitamente e receba clientes.{' '}
            <Link to="/cadastro" className="font-semibold text-accent hover:underline">Cadastrar agora →</Link>
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-accent" /> Profissionais verificados</span>
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-accent" /> Em todo o Brasil</span>
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-accent" /> Resposta rápida</span>
          </motion.div>
        </div>
      </section>

      {/* Categorias Populares – Flat Grid */}
      <section className="py-14">
        <div className="container">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Categorias Populares</h2>
              <p className="mt-1 text-sm text-muted-foreground">Encontre o profissional ideal para o serviço que você precisa</p>
            </div>
            <Button variant="ghost" size="sm" className="hidden text-accent md:flex" asChild>
              <Link to="/buscar">Ver todas <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
          {catsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {topCategories.map((cat) => (
                  <CategoryCard key={cat.id} category={cat} />
                ))}
              </div>
              {categories.length > 6 && (
                <div className="mt-4 text-center md:hidden">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/buscar">Ver todas as categorias</Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Profissionais em Destaque */}
      {featuredEnabled && (
      <section className="bg-muted/50 py-14">
        <div className="container">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Profissionais em Destaque</h2>
              <p className="mt-1 text-sm text-muted-foreground">Os mais bem avaliados da plataforma</p>
            </div>
            <Button variant="ghost" size="sm" className="hidden text-accent md:flex" asChild>
              <Link to="/buscar">Ver todos <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
          {provsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : featuredProviders.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum profissional em destaque ainda.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredProviders.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} />
              ))}
            </div>
          )}
          <div className="mt-6 text-center md:hidden">
            <Button variant="outline" asChild>
              <Link to="/buscar">Ver todos os profissionais</Link>
            </Button>
          </div>
        </div>
      </section>
      )}

      {/* Serviços Recentes */}
      {recentServices.length > 0 && (
        <section className="py-14">
          <div className="container">
            <div className="mb-8">
              <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Serviços Recentes</h2>
              <p className="mt-1 text-sm text-muted-foreground">Últimos serviços cadastrados na plataforma</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentServices.map((service: any) => (
                <div key={service.id} className="rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-base font-bold text-foreground">{service.service_name}</h3>
                      {service.category && (
                        <Link to={`/categoria/${service.category.slug}`} className="mt-0.5 inline-block text-xs font-medium text-accent hover:underline">
                          {service.category.icon} {service.category.name}
                        </Link>
                      )}
                    </div>
                    {service.price && (
                      <span className="shrink-0 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                        {service.price}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
                  {service.provider && (
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{service.provider.name}</span>
                        {service.provider.city && <span> · {service.provider.city}-{service.provider.state}</span>}
                      </div>
                      {service.provider.slug && (
                        <Link to={`/profissional/${service.provider.slug}`} className="text-xs font-medium text-accent hover:underline">
                          Ver perfil
                        </Link>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(service.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Profissionais por Cidade */}
      {topCities.length > 0 && (
        <section className="bg-muted/50 py-14">
          <div className="container">
            <div className="mb-8 text-center">
              <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Profissionais por Cidade</h2>
              <p className="mt-1 text-sm text-muted-foreground">Encontre profissionais nas maiores cidades do Brasil</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {topCities.map((city) => (
                <Link
                  key={city.slug}
                  to={`/cidade/${city.slug}`}
                  className="rounded-xl border border-border bg-card p-4 text-center shadow-card transition-colors hover:border-accent hover:-translate-y-0.5"
                >
                  <span className="font-display text-sm font-bold text-foreground">{city.name}</span>
                  <span className="ml-1 text-xs text-muted-foreground">- {city.state}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Cadastro */}
      <section className="py-14">
        <div className="container">
          <div className="rounded-2xl bg-accent/5 border border-accent/20 p-8 md:p-12 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              Quer mais clientes?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Cadastre seus serviços gratuitamente e comece a receber solicitações de clientes na sua região.
            </p>
            <Button variant="accent" size="xl" className="mt-6 rounded-full" asChild>
              <Link to="/cadastro">Cadastrar serviço <ArrowRight className="h-5 w-5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Patrocinadores – Banners */}
      {bannerSponsors.length > 0 && (
        <section className="py-10">
          <div className="container">
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Patrocinadores</p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {bannerSponsors.map((sponsor: any) => (
                <a
                  key={sponsor.id}
                  href={sponsor.link_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block transition-opacity hover:opacity-80"
                  title={sponsor.title}
                >
                  {sponsor.image_url ? (
                    <img src={sponsor.image_url} alt={sponsor.title} className="h-12 max-w-[200px] object-contain" />
                  ) : (
                    <span className="rounded-lg border border-border bg-card px-6 py-3 text-sm font-medium text-muted-foreground">
                      {sponsor.title}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Patrocinadores – Cards */}
      {cardSponsors.length > 0 && (
        <section className="pb-10">
          <div className="container">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cardSponsors.map((sponsor: any) => (
                <a
                  key={sponsor.id}
                  href={sponsor.link_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Patrocinado
                  </div>
                  {sponsor.image_url && (
                    <img src={sponsor.image_url} alt={sponsor.title} className="mt-3 h-20 w-full rounded-lg object-cover" />
                  )}
                  <h3 className="mt-3 font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors">
                    {sponsor.title}
                  </h3>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Como Funciona */}
      <section className="py-14">
        <div className="container">
          <div className="mb-10 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Como Funciona</h2>
            <p className="mt-2 text-muted-foreground">Simples, rápido e seguro</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {howItWorks.map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-3xl">
                  {item.icon}
                </div>
                <div className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {item.step}
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Buscas Populares */}
      {popularSearchesEnabled && allCategories.length > 0 && topCities.length > 0 && (
        <section className="bg-muted/50 py-14">
          <div className="container">
            <div className="mb-8 text-center">
              <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Buscas Populares</h2>
              <p className="mt-2 text-muted-foreground">As buscas mais realizadas na plataforma</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {allCategories.slice(0, 6).flatMap((cat) =>
                topCities.slice(0, 4).map((city) => (
                  <Link
                    key={`${cat.slug}-${city.slug}`}
                    to={`/${cat.slug}-${city.slug}`}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
                  >
                    {cat.name} em {city.name}
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* Depoimentos */}
      {reviewsEnabled && (
        <section className="py-14">
          <div className="container">
            <div className="mb-8 text-center">
              <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">O que dizem nossos usuários</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-card">
                  <StarRating rating={t.rating} showValue={false} size={14} />
                  <p className="mt-3 text-sm text-foreground">"{t.text}"</p>
                  <div className="mt-4 text-sm">
                    <span className="font-semibold text-foreground">{t.name}</span>
                    <span className="text-muted-foreground"> — {t.city}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqEnabled && (
      <section className="bg-muted/50 py-14">
        <div className="container max-w-2xl">
          <h2 className="mb-8 text-center font-display text-2xl font-bold text-foreground md:text-3xl">Perguntas Frequentes</h2>
          {[
            { q: 'Como encontro um profissional?', a: 'Use a barra de busca para pesquisar pelo serviço e sua cidade. Você verá uma lista de profissionais verificados com avaliações.' },
            { q: 'O cadastro é gratuito?', a: 'Sim! Profissionais podem se cadastrar gratuitamente no plano básico. Planos PRO e Premium oferecem mais visibilidade.' },
            { q: 'Como funciona a avaliação?', a: 'Após contratar um serviço, você pode avaliar o profissional com notas de 1 a 5 estrelas em qualidade, pontualidade e atendimento.' },
            { q: 'É seguro contratar pela plataforma?', a: 'Todos os profissionais passam por verificação. Além disso, as avaliações de outros clientes ajudam na sua decisão.' },
          ].map((faq, i) => (
            <details key={i} className="group mb-3 rounded-lg border border-border bg-card">
              <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground">
                {faq.q}
              </summary>
              <p className="px-5 pb-4 text-sm text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
      )}

      {/* Final CTA */}
      <section className="py-14">
        <div className="container text-center">
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
            Pronto para encontrar o profissional ideal?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Milhares de profissionais esperando para atender você.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button variant="hero" size="xl" className="rounded-full" asChild>
              <Link to="/buscar">Buscar Profissional</Link>
            </Button>
            <Button variant="outline" size="xl" className="rounded-full" asChild>
              <Link to="/cadastro">Sou Profissional</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
