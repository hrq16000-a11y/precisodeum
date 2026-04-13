import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, ArrowRight, Users, Building2, Sparkles, TrendingUp, Navigation } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useGeoCity } from '@/hooks/useGeoCity';
import { calculateDistanceKm } from '@/lib/geoDistance';
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

const PREPOSITIONS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas']);
const normalizeCity = (name: string) => {
  return name.trim().toLowerCase().split(/\s+/).map((w, i) =>
    i > 0 && PREPOSITIONS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
};

// Known approximate coordinates for Brazilian state capitals
const STATE_COORDS: Record<string, { lat: number; lon: number }> = {
  AC: { lat: -9.97, lon: -67.81 }, AL: { lat: -9.67, lon: -35.74 }, AM: { lat: -3.12, lon: -60.02 },
  AP: { lat: 0.03, lon: -51.05 }, BA: { lat: -12.97, lon: -38.51 }, CE: { lat: -3.72, lon: -38.53 },
  DF: { lat: -15.79, lon: -47.88 }, ES: { lat: -20.32, lon: -40.34 }, GO: { lat: -16.68, lon: -49.25 },
  MA: { lat: -2.53, lon: -44.28 }, MG: { lat: -19.92, lon: -43.94 }, MS: { lat: -20.44, lon: -54.65 },
  MT: { lat: -15.60, lon: -56.10 }, PA: { lat: -1.46, lon: -48.50 }, PB: { lat: -7.12, lon: -34.86 },
  PE: { lat: -8.05, lon: -34.87 }, PI: { lat: -5.09, lon: -42.81 }, PR: { lat: -25.43, lon: -49.27 },
  RJ: { lat: -22.91, lon: -43.17 }, RN: { lat: -5.79, lon: -35.21 }, RO: { lat: -8.76, lon: -63.90 },
  RR: { lat: 2.82, lon: -60.67 }, RS: { lat: -30.03, lon: -51.23 }, SC: { lat: -27.59, lon: -48.55 },
  SE: { lat: -10.91, lon: -37.07 }, SP: { lat: -23.55, lon: -46.63 }, TO: { lat: -10.18, lon: -48.33 },
};

const CitiesListPage = () => {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const geo = useGeoCity();

  useSeoHead({
    title: 'Profissionais em Todo o Brasil | Preciso de um',
    description: 'Encontre um profissional para qualquer tipo de serviço na sua cidade. Cobertura em todos os estados brasileiros.',
    canonical: `${SITE_BASE_URL}/cidades`,
  });

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

  const { data: topCitiesRaw = [] } = useQuery({
    queryKey: ['top-cities-providers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('providers')
        .select('city, state, latitude, longitude')
        .eq('status', 'approved')
        .is('deleted_at', null);
      if (!data) return [];
      const map = new Map<string, { name: string; state: string; count: number; lat: number | null; lon: number | null }>();
      data.forEach(p => {
        if (!p.city) return;
        const normalized = normalizeCity(p.city);
        const stateUf = p.state?.toUpperCase().trim() || '';
        const key = `${normalized}|${stateUf}`;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { name: normalized, state: stateUf, count: 1, lat: p.latitude, lon: p.longitude });
        } else {
          existing.count++;
          if (!existing.lat && p.latitude) { existing.lat = p.latitude; existing.lon = p.longitude; }
        }
      });
      return Array.from(map.values());
    },
    staleTime: 1000 * 60 * 10,
  });

  // Sort top cities by GPS proximity when available
  const topCities = useMemo(() => {
    const hasGps = geo.latitude != null && geo.longitude != null;
    if (!hasGps) {
      return [...topCitiesRaw].sort((a, b) => b.count - a.count).slice(0, 10);
    }
    return [...topCitiesRaw]
      .map(c => {
        let dist = Infinity;
        if (c.lat != null && c.lon != null) {
          dist = calculateDistanceKm(
            { latitude: geo.latitude!, longitude: geo.longitude! },
            { latitude: c.lat, longitude: c.lon }
          );
        }
        return { ...c, distanceKm: Math.round(dist * 10) / 10 };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 10);
  }, [topCitiesRaw, geo.latitude, geo.longitude]);

  // Sort states by proximity when GPS available
  const sortedStates = useMemo(() => {
    const hasGps = geo.latitude != null && geo.longitude != null;
    const entries = Object.entries(STATE_NAMES);
    if (!hasGps) return entries.sort(([, a], [, b]) => a.localeCompare(b));
    return entries
      .map(([uf, name]) => {
        const coords = STATE_COORDS[uf];
        const dist = coords
          ? calculateDistanceKm({ latitude: geo.latitude!, longitude: geo.longitude! }, { latitude: coords.lat, longitude: coords.lon })
          : Infinity;
        return { uf, name, dist };
      })
      .sort((a, b) => a.dist - b.dist)
      .map(({ uf, name }) => [uf, name] as [string, string]);
  }, [geo.latitude, geo.longitude]);

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
  const hasGps = geo.latitude != null && geo.longitude != null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary py-16 md:py-24">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-white/[0.03]" />

        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm">
              <MapPin className="h-3.5 w-3.5" />
              Cobertura em {activeStates} estados • {totalProviders}+ profissionais
            </div>

            {geo.city ? (
              <>
                <h1 className="font-display text-3xl font-bold text-white md:text-5xl leading-tight">
                  Profissionais em{' '}
                  <span className="text-accent drop-shadow-sm">{geo.city}</span>
                </h1>
                <p className="mt-4 text-base text-white/80 md:text-lg max-w-lg mx-auto">
                  Detectamos sua localização. Encontre os melhores profissionais da sua região.
                </p>
              </>
            ) : (
              <>
                <h1 className="font-display text-3xl font-bold text-white md:text-5xl leading-tight">
                  Encontre profissionais em{' '}
                  <span className="text-accent drop-shadow-sm">todo o Brasil</span>
                </h1>
                <p className="mt-4 text-base text-white/80 md:text-lg max-w-lg mx-auto">
                  Conecte-se com profissionais qualificados na sua cidade.
                </p>
              </>
            )}

            {!hasGps && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-full border-white/30 text-white hover:bg-white/20"
                  onClick={() => geo.requestPreciseLocation()}
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Ativar GPS para ordenar por proximidade
                </Button>
              </motion.div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {geoCity ? (
                <Button size="lg" className="rounded-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-xl text-base px-8 h-12" asChild>
                  <Link to={`/cidade/${geoCity.slug}`}>
                    <Search className="h-4 w-4" /> Buscar em {geoCity.name}
                  </Link>
                </Button>
              ) : (
                <Button size="lg" className="rounded-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-xl text-base px-8 h-12" asChild>
                  <Link to="/buscar">
                    <Search className="h-4 w-4" /> Buscar profissionais
                  </Link>
                </Button>
              )}
              <Button size="lg" className="rounded-full gap-2 bg-white/20 hover:bg-white/30 text-white border-2 border-white/40 backdrop-blur-sm text-base px-8 h-12" asChild>
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
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-muted-foreground/20" /> Sem cobertura</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary/60" /> Ativa</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary" /> Alta densidade</span>
              </div>
            </motion.div>

            {/* Top cities + state grid */}
            <div className="space-y-8">
              {topCities.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-accent" />
                    <h2 className="font-display text-lg font-bold text-foreground">
                      {hasGps ? 'Cidades mais próximas' : 'Cidades com mais profissionais'}
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
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {hasGps && (city as any).distanceKm != null && (city as any).distanceKm !== Infinity && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              📍 {(city as any).distanceKm < 1 ? '< 1' : (city as any).distanceKm} km
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {city.count}
                          </span>
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
                    Explorar por Estado {hasGps && <span className="text-xs font-normal text-muted-foreground">(por proximidade)</span>}
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {sortedStates.map(([uf, name]) => {
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
