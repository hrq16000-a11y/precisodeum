import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

const CitiesListPage = () => {
  const [search, setSearch] = useState('');

  useSeoHead({
    title: 'Cidades com Profissionais | Preciso de um',
    description: 'Encontre profissionais de confiança na sua cidade. Navegue por todas as cidades com prestadores cadastrados.',
    canonical: `${SITE_BASE_URL}/cidades`,
  });

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ['all-cities-with-providers'],
    queryFn: async () => {
      const { data: providers } = await supabase
        .from('providers')
        .select('city, state')
        .eq('status', 'approved');
      if (!providers || providers.length === 0) return [];

      const cityMap = new Map<string, string>();
      providers.forEach((p) => {
        if (p.city) cityMap.set(p.city, p.state || '');
      });

      const cityNames = [...cityMap.keys()];
      const { data: dbCities } = await supabase
        .from('cities')
        .select('name, slug, state')
        .in('name', cityNames)
        .order('name');

      return dbCities || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return cities;
    const q = search.toLowerCase();
    return cities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
    );
  }, [cities, search]);

  // Group by state
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((c) => {
      const list = map.get(c.state) || [];
      list.push(c);
      map.set(c.state, list);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <section className="bg-hero py-10">
        <div className="container text-center">
          <h1 className="font-display text-2xl font-bold text-primary-foreground md:text-4xl">
            Profissionais por Cidade
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-primary-foreground/70">
            Escolha sua cidade para encontrar profissionais qualificados
          </p>
          <div className="mx-auto mt-4 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cidade ou estado..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="container flex-1 py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-lg font-semibold text-foreground">Nenhuma cidade encontrada</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {search ? 'Tente outra busca.' : 'Ainda não temos cidades cadastradas com profissionais.'}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link to="/cadastro" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
                Cadastre-se como profissional
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([state, stateCities]) => (
              <div key={state}>
                <h2 className="mb-3 font-display text-lg font-bold text-foreground">{state}</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {stateCities.map((city) => (
                    <Link
                      key={city.slug}
                      to={`/cidade/${city.slug}`}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-card transition-all hover:border-primary hover:-translate-y-0.5 hover:shadow-card-hover"
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-accent" />
                      <span className="text-sm font-semibold text-foreground">{city.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default CitiesListPage;
