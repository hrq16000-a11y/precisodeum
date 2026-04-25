import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, MapPin, Sparkles, HelpCircle, Building2, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useJsonLd } from '@/hooks/useJsonLd';
import { SITE_BASE_URL } from '@/hooks/useSeoHead';
import { cn } from '@/lib/utils';

interface Props {
  citySlug: string;
  cityName: string;
  state?: string | null;
  providersCount: number;
  /** Profissionais já carregados pela página — usados para destaque (top 6 por rating). */
  featuredProviders?: Array<{
    slug?: string;
    name: string;
    category?: string;
    rating?: number;
    reviewCount?: number;
  }>;
}

/**
 * Bloco SEO programático para /cidade/:slug:
 *  - Texto único long-tail por cidade
 *  - FAQ acessível com JSON-LD
 *  - Top categorias mais buscadas na cidade
 *  - Profissionais em destaque (links internos)
 *  - Cidades vizinhas (links internos)
 */
const CitySeoBlock = ({ citySlug, cityName, state, providersCount, featuredProviders = [] }: Props) => {
  // Top categorias com profissionais cadastrados na cidade
  const { data: cityCategories } = useQuery({
    queryKey: ['city-top-categories', citySlug],
    enabled: !!cityName,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('providers')
        .select('categories(slug, name)')
        .eq('status', 'approved')
        .ilike('city', `%${cityName}%`)
        .limit(300);
      const counts = new Map<string, { slug: string; name: string; count: number }>();
      (data || []).forEach((row: any) => {
        const c = row?.categories;
        if (!c?.slug) return;
        const existing = counts.get(c.slug);
        if (existing) existing.count += 1;
        else counts.set(c.slug, { slug: c.slug, name: c.name, count: 1 });
      });
      return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 10);
    },
  });

  // Cidades vizinhas (mesmo estado)
  const { data: nearbyCities } = useQuery({
    queryKey: ['city-nearby', citySlug, state],
    enabled: !!state,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('cities')
        .select('slug, name, state')
        .eq('state', state)
        .neq('slug', citySlug)
        .order('name')
        .limit(8);
      return (data || []) as Array<{ slug: string; name: string; state: string }>;
    },
  });

  const topFeatured = useMemo(
    () =>
      [...featuredProviders]
        .filter((p) => p.slug)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 6),
    [featuredProviders]
  );

  // FAQs específicas por cidade
  const faqs = useMemo(() => {
    const here = `${cityName}${state ? ' / ' + state : ''}`;
    return [
      {
        q: `Como encontro um profissional confiável em ${cityName}?`,
        a: `No Preciso de Um você compara perfis verificados de profissionais de ${here}, com avaliações reais, fotos do trabalho e contato direto via WhatsApp. Sem intermediação e sem leilão de preços.`,
      },
      {
        q: `Quanto custa contratar pelo Preciso de Um em ${cityName}?`,
        a: `A plataforma é 100% gratuita para clientes. O valor do serviço é negociado diretamente entre você e o profissional escolhido em ${cityName}.`,
      },
      {
        q: `Os profissionais de ${cityName} são verificados?`,
        a: `Sim. Todos os perfis aprovados passam por checagem básica e exibem badges públicos como "Trabalhando agora" e "Ativo hoje" para transparência sobre disponibilidade real.`,
      },
      {
        q: `Posso contratar com urgência em ${cityName}?`,
        a: `Sim. Use o filtro "Trabalhando agora" no /buscar para ver apenas quem está disponível neste momento em ${here} — ideal para emergências (chaveiro, encanador, eletricista).`,
      },
    ];
  }, [cityName, state]);

  const faqLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      // url canônica garante que crawlers tratem como JSON-LD desta rota
      url: `${SITE_BASE_URL}/cidade/${citySlug}`,
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    }),
    [faqs, citySlug]
  );
  // ID único por slug → evita colidir com FAQs de outras rotas (categoria etc.)
  useJsonLd(faqLd, `json-ld-faq-cidade-${citySlug}`);

  return (
    <section className="border-t bg-muted/20" aria-labelledby="cidade-seo-titulo">
      <div className="container py-12 md:py-16 max-w-5xl">
        {/* Texto único long-tail */}
        <div className="mb-10">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Guia da cidade
          </div>
          <h2 id="cidade-seo-titulo" className="mb-3 text-2xl font-bold md:text-3xl">
            Profissionais em {cityName}{state ? ` / ${state}` : ''}: como contratar com segurança
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            O Preciso de Um conecta moradores de {cityName} aos melhores profissionais autônomos da
            região. Hoje há{' '}
            <strong className="text-foreground">{providersCount.toLocaleString('pt-BR')}</strong>{' '}
            {providersCount === 1 ? 'profissional cadastrado' : 'profissionais cadastrados'} em{' '}
            {cityName}, com avaliações reais e contato direto pelo WhatsApp. Sem leilão de preços,
            sem intermediação — você fala diretamente com o profissional escolhido.
          </p>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <Card className="p-3">
              <p className="mb-1 font-semibold">1. Filtre por bairro</p>
              <p className="text-xs text-muted-foreground">
                Ative o GPS e veja quem atende perto de você em {cityName}.
              </p>
            </Card>
            <Card className="p-3">
              <p className="mb-1 font-semibold">2. Compare perfis</p>
              <p className="text-xs text-muted-foreground">
                Avaliações, portfólio e tempo de resposta lado a lado.
              </p>
            </Card>
            <Card className="p-3">
              <p className="mb-1 font-semibold">3. Fale direto</p>
              <p className="text-xs text-muted-foreground">
                WhatsApp do profissional, sem intermediário.
              </p>
            </Card>
          </div>
        </div>

        {/* Categorias mais buscadas */}
        {cityCategories && cityCategories.length > 0 && (
          <div className="mb-10">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Building2 className="h-4 w-4 text-primary" />
              Serviços mais buscados em {cityName}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {cityCategories.map((c) => (
                <Link
                  key={c.slug}
                  to={`/${c.slug}-${citySlug}`}
                  className="group flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="truncate">
                    {c.name} <span className="text-muted-foreground">em {cityName}</span>
                  </span>
                  <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    {c.count}
                    <ChevronRight className="h-4 w-4 transition-colors group-hover:text-primary" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Profissionais em destaque */}
        {topFeatured.length > 0 && (
          <div className="mb-10">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Star className="h-4 w-4 text-primary" />
              Profissionais em destaque em {cityName}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {topFeatured.map((p) => (
                <Link
                  key={p.slug}
                  to={`/profissional/${p.slug}`}
                  className="group flex flex-col rounded-lg border bg-background p-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="truncate font-semibold">{p.name}</span>
                  {p.category && (
                    <span className="truncate text-xs text-muted-foreground">{p.category}</span>
                  )}
                  {(p.rating ?? 0) > 0 && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-600">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {(p.rating || 0).toFixed(1)}
                      {(p.reviewCount ?? 0) > 0 && (
                        <span className="text-muted-foreground">({p.reviewCount})</span>
                      )}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Cidades vizinhas */}
        {nearbyCities && nearbyCities.length > 0 && (
          <div className="mb-10">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <MapPin className="h-4 w-4 text-primary" />
              Cidades próximas em {state}
            </h3>
            <div className="flex flex-wrap gap-2">
              {nearbyCities.map((c) => (
                <Link
                  key={c.slug}
                  to={`/cidade/${c.slug}`}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  {c.name}
                  <span className="text-muted-foreground">/{c.state}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <HelpCircle className="h-4 w-4 text-primary" />
            Perguntas frequentes sobre profissionais em {cityName}
          </h3>
          <div className="space-y-3">
            {faqs.map((f, idx) => (
              <details
                key={idx}
                className={cn(
                  'group rounded-lg border bg-background p-4 transition-colors',
                  'open:border-primary/30 open:bg-primary/5'
                )}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                  <span>{f.q}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>

        <link rel="canonical" href={`${SITE_BASE_URL}/cidade/${citySlug}`} />
      </div>
    </section>
  );
};

export default CitySeoBlock;
