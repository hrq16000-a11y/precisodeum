import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ArrowLeft, Users, Sparkles } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { motion } from 'framer-motion';

const STATE_NAMES: Record<string, string> = {
  ac: 'Acre', al: 'Alagoas', am: 'Amazonas', ap: 'Amapá',
  ba: 'Bahia', ce: 'Ceará', df: 'Distrito Federal', es: 'Espírito Santo',
  go: 'Goiás', ma: 'Maranhão', mg: 'Minas Gerais', ms: 'Mato Grosso do Sul',
  mt: 'Mato Grosso', pa: 'Pará', pb: 'Paraíba', pe: 'Pernambuco',
  pi: 'Piauí', pr: 'Paraná', rj: 'Rio de Janeiro', rn: 'Rio Grande do Norte',
  ro: 'Rondônia', rr: 'Roraima', rs: 'Rio Grande do Sul', sc: 'Santa Catarina',
  se: 'Sergipe', sp: 'São Paulo', to: 'Tocantins',
};

const StateProviderPage = () => {
  const { estado } = useParams<{ estado: string }>();
  const uf = (estado || '').toUpperCase();
  const stateName = STATE_NAMES[estado?.toLowerCase() || ''] || uf;

  useSeoHead({
    title: `Profissionais em ${stateName} | Preciso de um`,
    description: `Encontre profissionais qualificados em ${stateName}. Veja cidades com prestadores ativos.`,
    canonical: `${SITE_BASE_URL}/cidades/${estado}`,
  });

  // Cities in this state with provider counts
  const { data: cities = [], isLoading } = useQuery({
    queryKey: ['state-cities', uf],
    queryFn: async () => {
      // Get cities in this state
      const { data: stateCities } = await supabase
        .from('cities')
        .select('name, slug, state_uf')
        .eq('state_uf', uf)
        .order('name');

      // Get provider counts for this state
      const { data: providers } = await supabase
        .from('providers')
        .select('city')
        .eq('state', uf)
        .eq('status', 'approved')
        .is('deleted_at', null);

      const countMap = new Map<string, number>();
      providers?.forEach(p => {
        const city = p.city?.trim();
        if (city) countMap.set(city.toLowerCase(), (countMap.get(city.toLowerCase()) || 0) + 1);
      });

      return (stateCities || []).map(c => ({
        ...c,
        count: countMap.get(c.name.toLowerCase()) || 0,
      })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    },
    staleTime: 1000 * 60 * 10,
  });

  const totalProviders = useMemo(() => cities.reduce((s, c) => s + c.count, 0), [cities]);
  const citiesWithProviders = useMemo(() => cities.filter(c => c.count > 0), [cities]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-[var(--hero-gradient)] py-12">
        <div className="container">
          <Button variant="ghost" size="sm" className="text-white/70 hover:text-white mb-4 -ml-2" asChild>
            <Link to="/cidades"><ArrowLeft className="h-4 w-4 mr-1" /> Todos os estados</Link>
          </Button>
          <h1 className="font-display text-2xl font-bold text-white md:text-4xl">
            Profissionais em <span className="text-accent">{stateName}</span>
          </h1>
          <p className="mt-2 text-white/70">
            {totalProviders > 0
              ? `${totalProviders} profissional(is) em ${citiesWithProviders.length} cidade(s)`
              : 'Ainda não temos profissionais cadastrados neste estado'}
          </p>
        </div>
      </section>

      <div className="container flex-1 py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : cities.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-accent" />
            <p className="text-lg font-semibold text-foreground">Nenhuma cidade cadastrada em {stateName}</p>
            <p className="mt-2 text-sm text-muted-foreground">Seja o primeiro profissional da região!</p>
            <Button className="mt-4 rounded-full" asChild>
              <Link to="/cadastro">Cadastrar como profissional</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Cities with providers */}
            {citiesWithProviders.length > 0 && (
              <div className="mb-8">
                <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-accent" />
                  Cidades com profissionais ativos
                </h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {citiesWithProviders.map(city => (
                    <motion.div
                      key={city.slug}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Link
                        to={`/cidade/${city.slug}`}
                        className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md group"
                      >
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-accent shrink-0" />
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{city.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-accent">{city.count} prof.</span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Cities without providers */}
            {cities.filter(c => c.count === 0).length > 0 && (
              <div>
                <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  Aguardando profissionais
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {cities.filter(c => c.count === 0).map(city => (
                    <Link
                      key={city.slug}
                      to={`/cadastro`}
                      className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card/50 p-3 text-sm transition-all hover:border-accent/40 hover:bg-card group"
                    >
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors truncate">{city.name}</span>
                    </Link>
                  ))}
                </div>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  <Link to="/cadastro" className="text-accent font-semibold hover:underline">
                    Cadastre-se e seja o primeiro profissional nestas cidades →
                  </Link>
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default StateProviderPage;
