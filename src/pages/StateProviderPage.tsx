import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ArrowLeft, Users, Sparkles, ArrowRight, TrendingUp } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
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
    description: `Encontre um profissional para qualquer tipo de serviço em ${stateName}. Veja cidades com prestadores ativos.`,
    canonical: `${SITE_BASE_URL}/cidades/${estado}`,
  });

  // Use pre-computed provider_count — single fast query
  const { data: cities = [], isLoading } = useQuery({
    queryKey: ['state-cities-v2', uf],
    queryFn: async () => {
      const { data } = await supabase
        .from('cities')
        .select('name, slug, state_uf, provider_count')
        .eq('state_uf', uf)
        .order('provider_count', { ascending: false });
      return (data || []).sort((a, b) => 
        (b.provider_count || 0) - (a.provider_count || 0) || a.name.localeCompare(b.name)
      );
    },
    staleTime: 1000 * 60 * 10,
  });

  const totalProviders = useMemo(() => cities.reduce((s, c) => s + (c.provider_count || 0), 0), [cities]);
  const citiesWithProviders = useMemo(() => cities.filter(c => (c.provider_count || 0) > 0), [cities]);
  const citiesWithout = useMemo(() => cities.filter(c => (c.provider_count || 0) === 0), [cities]);

  // JSON-LD
  const jsonLd = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'State',
    name: stateName,
    containedInPlace: { '@type': 'Country', name: 'Brazil' },
    ...(citiesWithProviders.length > 0 && {
      containsPlace: citiesWithProviders.slice(0, 10).map(c => ({
        '@type': 'City',
        name: c.name,
        url: `${SITE_BASE_URL}/cidades/${estado}/${c.slug}`,
      })),
    }),
  }), [stateName, citiesWithProviders, estado]);
  useJsonLd(jsonLd);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="relative overflow-hidden bg-primary py-12">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/5" />
        <div className="container relative z-10">
          <Button variant="ghost" size="sm" className="text-white/70 hover:text-white mb-4 -ml-2" asChild>
            <Link to="/cidades"><ArrowLeft className="h-4 w-4 mr-1" /> Todos os estados</Link>
          </Button>
          <h1 className="font-display text-2xl font-bold text-white md:text-4xl">
            Profissionais em <span className="text-accent">{stateName}</span>
          </h1>
          <p className="mt-2 text-white/70">
            {totalProviders > 0
              ? `${totalProviders} profissional(is) em ${citiesWithProviders.length} cidade(s)`
              : 'Seja o primeiro profissional a se cadastrar neste estado!'}
          </p>
          {totalProviders === 0 && (
            <Button size="lg" className="mt-4 rounded-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
              <Link to="/cadastro"><Sparkles className="h-4 w-4" /> Cadastrar agora</Link>
            </Button>
          )}
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
            {citiesWithProviders.length > 0 && (
              <div className="mb-8">
                <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-accent" />
                  Cidades com profissionais ativos
                </h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {citiesWithProviders.map(city => (
                    <motion.div key={city.slug} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <Link
                        to={`/cidades/${estado}/${city.slug}`}
                        className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md group"
                      >
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-accent shrink-0" />
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{city.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-accent">{city.provider_count} prof.</span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {citiesWithout.length > 0 && (
              <div>
                <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  Aguardando profissionais
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {citiesWithout.map(city => (
                    <Link
                      key={city.slug}
                      to={`/cidades/${estado}/${city.slug}`}
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

      {/* SEO text */}
      <section className="border-t border-border bg-muted/50 py-10">
        <div className="container max-w-3xl">
          <h2 className="font-display text-lg font-bold text-foreground mb-3">
            Sobre profissionais em {stateName}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {totalProviders > 0
              ? `O estado de ${stateName} conta com ${totalProviders} profissionais cadastrados em ${citiesWithProviders.length} cidade(s). Navegue pelas cidades acima para encontrar o profissional ideal para seu projeto, comparando avaliações e portfólios.`
              : `${stateName} ainda está aguardando seus primeiros profissionais na plataforma Preciso de um. Cadastre-se e seja referência em sua cidade com destaque total nas buscas locais.`}
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default StateProviderPage;
