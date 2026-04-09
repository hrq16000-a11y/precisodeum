import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, ArrowRight, Users, Building2, Sparkles, TrendingUp } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useGeoCity } from '@/hooks/useGeoCity';
import { motion } from 'framer-motion';
import BrazilMapSVG from '@/components/home/BrazilMapSVG';

const STATE_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá',
  BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
  GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco',
  PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina',
  SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
};

const CitiesListPage = () => {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const geo = useGeoCity();

  useSeoHead({
    title: 'Profissionais em Todo o Brasil | Preciso de um',
    description: 'Encontre profissionais qualificados na sua cidade. Cobertura em todos os estados brasileiros.',
    canonical: `${SITE_BASE_URL}/cidades`,
  });

  // Provider count per state
  const { data: stateStats = [] } = useQuery({
    queryKey: ['state-provider-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('providers')
        .select('state')
        .eq('status', 'approved')
        .is('deleted_at', null);
      if (!data) return [];
      const map = new Map<string, number>();
      data.forEach(p => {
        const uf = p.state?.toUpperCase().trim();
        if (uf && uf.length === 2) map.set(uf, (map.get(uf) || 0) + 1);
      });
      return Array.from(map.entries()).map(([uf, providers]) => ({ uf, providers })).sort((a, b) => b.providers - a.providers);
    },
    staleTime: 1000 * 60 * 10,
  });

  // Top 10 cities by providers
  const { data: topCities = [] } = useQuery({
    queryKey: ['top-cities-providers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('providers')
        .select('city, state')
        .eq('status', 'approved')
        .is('deleted_at', null);
      if (!data) return [];
      const map = new Map<string, { name: string; state: string; count: number }>();
      data.forEach(p => {
        const key = `${p.city?.trim()}|${p.state?.trim()}`;
        if (p.city) {
          const existing = map.get(key);
          map.set(key, { name: p.city.trim(), state: p.state?.trim() || '', count: (existing?.count || 0) + 1 });
        }
      });
      return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
    },
    staleTime: 1000 * 60 * 10,
  });

  // Geo-detected city match
  const { data: geoCity } = useQuery({
    queryKey: ['geo-city-match', geo.city],
    queryFn: async () => {
      if (!geo.city) return null;
      const { data } = await supabase
        .from('cities')
        .select('name, slug, state_uf')
        .ilike('name', geo.city)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!geo.city,
    staleTime: 1000 * 60 * 30,
  });

  // Search autocomplete cities (only when typing)
  const { data: searchResults = [] } = useQuery({
    queryKey: ['city-search', search],
    queryFn: async () => {
      if (!search.trim() || search.length < 2) return [];
      const { data } = await supabase
        .from('cities')
        .select('name, slug, state_uf')
        .ilike('name', `%${search.trim()}%`)
        .order('name')
        .limit(12);
      return data || [];
    },
    enabled: search.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const totalProviders = useMemo(() => stateStats.reduce((s, e) => s + e.providers, 0), [stateStats]);
  const activeStates = useMemo(() => stateStats.filter(s => s.providers > 0).length, [stateStats]);

  const handleStateClick = useCallback((uf: string) => {
    navigate(`/cidades/${uf.toLowerCase()}`);
  }, [navigate]);

  const geoStateUf = geo.state?.toUpperCase().trim();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[var(--hero-gradient)] py-16 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(25_95%_53%_/_0.08),transparent_70%)]" />
        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white/90">
              <MapPin className="h-3.5 w-3.5" />
              Cobertura em {activeStates} estados • {totalProviders}+ profissionais
            </div>

            {geo.city ? (
              <>
                <h1 className="font-display text-3xl font-bold text-white md:text-5xl leading-tight">
                  Profissionais em{' '}
                  <span className="text-accent">{geo.city}</span>
                </h1>
                <p className="mt-3 text-base text-white/70 md:text-lg">
                  Detectamos sua localização. Encontre os melhores profissionais da sua região.
                </p>
              </>
            ) : (
              <>
                <h1 className="font-display text-3xl font-bold text-white md:text-5xl leading-tight">
                  Encontre profissionais em{' '}
                  <span className="text-accent">todo o Brasil</span>
                </h1>
                <p className="mt-3 text-base text-white/70 md:text-lg">
                  Conecte-se com profissionais qualificados na sua cidade.
                </p>
              </>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {geoCity ? (
                <Button size="lg" className="rounded-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg" asChild>
                  <Link to={`/cidade/${geoCity.slug}`}>
                    <Search className="h-4 w-4" /> Buscar em {geoCity.name}
                  </Link>
                </Button>
              ) : (
                <Button size="lg" className="rounded-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg" asChild>
                  <Link to="/buscar">
                    <Search className="h-4 w-4" /> Buscar profissionais
                  </Link>
                </Button>
              )}
              <Button size="lg" variant="outline" className="rounded-full gap-2 border-white/20 text-white hover:bg-white/10" asChild>
                <Link to="/cadastro">
                  <Sparkles className="h-4 w-4" /> Cadastrar meu serviço
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Search bar */}
      <section className="border-b border-border bg-card py-6">
        <div className="container">
          <div className="mx-auto max-w-lg relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 rounded-xl text-base"
            />
            {search.length >= 2 && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-xl max-h-64 overflow-y-auto">
                {searchResults.map(c => (
                  <Link
                    key={c.slug}
                    to={`/cidade/${c.slug}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
                    onClick={() => setSearch('')}
                  >
                    <MapPin className="h-4 w-4 text-accent shrink-0" />
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{c.state_uf}</span>
                  </Link>
                ))}
              </div>
            )}
            {search.length >= 2 && searchResults.length === 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-xl p-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">Cidade não encontrada na base</p>
                <Button size="sm" className="rounded-full gap-1.5" asChild>
                  <Link to="/cadastro">
                    <Sparkles className="h-3.5 w-3.5" /> Seja o primeiro profissional
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Map + Stats */}
      <section className="py-12 md:py-16">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2 items-start">
            {/* Map */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="font-display text-xl font-bold text-foreground mb-2">
                Mapa de Cobertura
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Clique em um estado para explorar profissionais
              </p>
              <BrazilMapSVG
                stateStats={stateStats}
                onStateClick={handleStateClick}
                highlightState={geoStateUf && geoStateUf.length === 2 ? geoStateUf : null}
              />
              <div className="mt-4 flex items-center gap-4 justify-center text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: 'hsl(210 20% 90%)' }} /> Sem cobertura</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: 'hsl(215 65% 55%)' }} /> Ativa</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: 'hsl(215 80% 25%)' }} /> Alta densidade</span>
              </div>
            </motion.div>

            {/* Top cities + state grid */}
            <div className="space-y-8">
              {/* Top cities */}
              {topCities.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-accent" />
                    <h2 className="font-display text-lg font-bold text-foreground">
                      Cidades com mais profissionais
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {topCities.map((city, i) => (
                      <Link
                        key={`${city.name}-${city.state}`}
                        to={`/buscar?q=${encodeURIComponent(city.name)}`}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md group"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">{city.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{city.state}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {city.count}
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* States grid */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-bold text-foreground">
                    Explorar por Estado
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Object.entries(STATE_NAMES).sort(([,a],[,b]) => a.localeCompare(b)).map(([uf, name]) => {
                    const count = stateStats.find(s => s.uf === uf)?.providers || 0;
                    return (
                      <Link
                        key={uf}
                        to={`/cidades/${uf.toLowerCase()}`}
                        className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5 text-sm transition-all hover:border-primary/40 hover:shadow-sm group"
                      >
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">{name}</span>
                        {count > 0 ? (
                          <span className="text-xs text-accent font-semibold">{count}</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Seja o 1°</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/50 py-14">
        <div className="container text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-accent" />
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              Sua cidade ainda não tem profissionais?
            </h2>
            <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
              Seja o primeiro a se cadastrar e receba clientes da sua região. Cadastro gratuito e rápido.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" className="rounded-full gap-2" asChild>
                <Link to="/cadastro">
                  Cadastrar como profissional <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CitiesListPage;
