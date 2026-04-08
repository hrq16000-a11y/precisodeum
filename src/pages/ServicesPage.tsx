import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, DollarSign, ArrowRight, Sparkles, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Header from '@/components/Header';
import FadeInSection from '@/components/FadeInSection';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';

interface PopularService {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  category_name: string;
  category_slug: string | null;
  min_price: number;
  active: boolean;
}

const ServicesPage = () => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useSeoHead({
    title: 'Serviços Profissionais | Preciso de um',
    description: 'Confira todos os serviços profissionais disponíveis na plataforma. Eletricista, encanador, pintor, pedreiro e muito mais. Solicite orçamentos grátis.',
    canonical: `${SITE_BASE_URL}/servicos`,
  });

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Serviços Profissionais',
    url: `${SITE_BASE_URL}/servicos`,
    description: 'Catálogo completo de serviços profissionais disponíveis na plataforma Preciso de um.',
  });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['all-popular-services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('popular_services')
        .select('*')
        .eq('active', true)
        .order('display_order');
      if (error) throw error;
      return (data || []) as PopularService[];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(services.map(s => s.category_name).filter(Boolean))];
    return cats.sort();
  }, [services]);

  // Filter
  const filtered = useMemo(() => {
    let result = services;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category_name.toLowerCase().includes(q)
      );
    }
    if (selectedCategory) {
      result = result.filter(s => s.category_name === selectedCategory);
    }
    return result;
  }, [services, search, selectedCategory]);


  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-accent/5 to-background py-10 md:py-14">
        <div className="container text-center">
          <FadeInSection>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Catálogo Completo
            </span>
            <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">
              Serviços Profissionais
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Encontre o serviço que você precisa. Compare preços, solicite orçamentos e contrate profissionais verificados.
            </p>
          </FadeInSection>

          {/* Search + Filter */}
          <FadeInSection delay={0.1} className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar serviço..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant={selectedCategory === '' ? 'accent' : 'outline'}
                size="sm"
                className="rounded-full text-xs"
                onClick={() => setSelectedCategory('')}
              >
                Todos
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'accent' : 'outline'}
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-10">
        <div className="container">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl border border-border bg-card p-5 h-48">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite] -translate-x-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-4xl">🔍</div>
                <p className="text-lg font-medium text-muted-foreground">Nenhum serviço encontrado</p>
                <p className="mt-1 text-sm text-muted-foreground">Tente buscar por outro termo</p>
                <Button variant="outline" className="mt-4" onClick={() => { setSearch(''); setSelectedCategory(''); }}>
                  Limpar filtros
                </Button>
              </motion.div>
            </div>
          ) : (
            <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" layout>
              {filtered.map((s, i) => (
                <FadeInSection key={s.id} delay={i * 0.03}>
                  <Link to={`/servico/${s.slug}`} className="group block">
                    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-accent/30">
                      {/* Gradient hover bg */}
                      <span className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent group-hover:from-accent/5 group-hover:to-primary/5 transition-all duration-500" />

                      <div className="relative flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-2xl transition-transform duration-300 group-hover:scale-110">
                          {s.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display text-base font-bold text-foreground group-hover:text-accent transition-colors line-clamp-1">
                            {s.name}
                          </h3>
                          <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground mt-1">
                            {s.category_name}
                          </span>
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {s.description}
                          </p>
                        </div>
                      </div>

                      <div className="relative mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="h-4 w-4 text-accent" />
                          <span className="font-bold text-foreground">
                            A partir de R$ {s.min_price}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-xs font-semibold text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                          Ver detalhes <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </FadeInSection>
              ))}
            </motion.div>
          )}

          {/* Total count */}
          {!isLoading && filtered.length > 0 && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Exibindo {filtered.length} {filtered.length === 1 ? 'serviço' : 'serviços'}
              {selectedCategory && ` em ${selectedCategory}`}
            </p>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30 py-10">
        <div className="container text-center">
          <h2 className="font-display text-xl font-bold text-foreground">
            Não encontrou o que procura?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Busque diretamente entre os profissionais cadastrados
          </p>
          <Button variant="accent" className="mt-4 rounded-full" asChild>
            <Link to="/buscar">
              <Search className="h-4 w-4" /> Buscar Profissionais
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ServicesPage;
