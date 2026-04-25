import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, MapPin, Sparkles, HelpCircle, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useJsonLd } from '@/hooks/useJsonLd';
import { getCategoryFaqs } from '@/lib/categoryFaqs';
import { SITE_BASE_URL } from '@/hooks/useSeoHead';
import { cn } from '@/lib/utils';

interface Props {
  categorySlug: string;
  categoryName: string;
  city?: string | null;
  state?: string | null;
  providersCount: number;
}

/**
 * Bloco de conteúdo SEO programático para /categoria/:slug:
 *  - Texto único (sintetizado a partir de slug + cidade) — ranking long-tail.
 *  - FAQ JSON-LD + UI acessível.
 *  - Links internos para cidades atendidas (top 8) e categorias relacionadas.
 *
 * Renderizar APÓS a listagem para não atrapalhar LCP, mas antes do Footer.
 */
const CategorySeoBlock = ({ categorySlug, categoryName, city, state, providersCount }: Props) => {
  const faqs = useMemo(() => getCategoryFaqs(categorySlug, categoryName), [categorySlug, categoryName]);

  // Cidades onde a categoria tem mais profissionais (top 8)
  const { data: cityList } = useQuery({
    queryKey: ['category-cities', categorySlug],
    enabled: !!categorySlug,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      // join via slug requer subquery: pega category id primeiro
      const catRes = await supabase
        .from('categories')
        .select('id')
        .eq('slug', categorySlug)
        .maybeSingle();
      const catId = (catRes.data as any)?.id;
      if (!catId) return [] as Array<{ city: string; state: string; count: number }>;
      const { data } = await supabase
        .from('providers')
        .select('city, state')
        .eq('category_id', catId)
        .not('city', 'is', null)
        .limit(300);
      const counts = new Map<string, { city: string; state: string; count: number }>();
      (data || []).forEach((row: any) => {
        if (!row?.city) return;
        const key = `${row.city}|${row.state || ''}`;
        const existing = counts.get(key);
        if (existing) existing.count += 1;
        else counts.set(key, { city: row.city, state: row.state || '', count: 1 });
      });
      return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 8);
    },
  });

  // Categorias relacionadas (top 6)
  const { data: relatedCategories } = useQuery({
    queryKey: ['related-categories', categorySlug],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('slug, name')
        .neq('slug', categorySlug)
        .order('name')
        .limit(60);
      // ordem aleatória estável (por hash do slug) limitada a 6
      return (data || []).slice(0, 6) as Array<{ slug: string; name: string }>;
    },
  });

  // FAQ JSON-LD
  const faqLd = useMemo(() => {
    if (!faqs?.length) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    };
  }, [faqs]);
  useJsonLd(faqLd);

  const locationLabel = city ? `${city}${state ? ' / ' + state : ''}` : null;
  const introTitle = locationLabel
    ? `${categoryName} em ${city}: como contratar com segurança`
    : `Como contratar um(a) ${categoryName.toLowerCase()} pelo Preciso de Um`;

  const introText = locationLabel
    ? `Encontre os melhores profissionais de ${categoryName.toLowerCase()} em ${city}. Hoje temos ${providersCount.toLocaleString('pt-BR')} ${
        providersCount === 1 ? 'profissional verificado' : 'profissionais verificados'
      } atendendo na região, com avaliações reais e contato direto pelo WhatsApp. Sem intermediação, sem leilão de preços — você fala diretamente com o(a) ${categoryName.toLowerCase()} de sua escolha.`
    : `O Preciso de Um conecta clientes a profissionais de ${categoryName.toLowerCase()} em todo o Brasil. Você compara perfis, avaliações e tempo de resposta, e fecha o serviço diretamente pelo WhatsApp — sem mensalidade, sem comissão e sem cadastro complicado.`;

  return (
    <section
      className="border-t bg-muted/20"
      aria-labelledby="categoria-seo-titulo"
    >
      <div className="container py-12 md:py-16 max-w-5xl">
        {/* Texto único / Long-tail */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Guia rápido
          </div>
          <h2 id="categoria-seo-titulo" className="text-2xl md:text-3xl font-bold mb-3">
            {introTitle}
          </h2>
          <p className="text-muted-foreground leading-relaxed">{introText}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
            <Card className="p-3">
              <p className="font-semibold mb-1">1. Compare</p>
              <p className="text-muted-foreground text-xs">Avaliações, tempo de resposta e portfólio.</p>
            </Card>
            <Card className="p-3">
              <p className="font-semibold mb-1">2. Converse</p>
              <p className="text-muted-foreground text-xs">Contato direto pelo WhatsApp, sem intermediação.</p>
            </Card>
            <Card className="p-3">
              <p className="font-semibold mb-1">3. Avalie</p>
              <p className="text-muted-foreground text-xs">Ajude a comunidade após o serviço.</p>
            </Card>
          </div>
        </div>

        {/* Cidades atendidas — links internos */}
        {cityList && cityList.length > 0 && (
          <div className="mb-10">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {categoryName} em outras cidades
            </h3>
            <div className="flex flex-wrap gap-2">
              {cityList.map((c) => {
                const citySlug = c.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
                return (
                  <Link
                    key={`${c.city}-${c.state}`}
                    to={`/cidade/${citySlug}`}
                    className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-xs hover:bg-primary/5 hover:border-primary/40 transition-colors"
                  >
                    {c.city}
                    {c.state && <span className="text-muted-foreground">/{c.state}</span>}
                    <span className="text-muted-foreground">·{c.count}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Categorias relacionadas */}
        {relatedCategories && relatedCategories.length > 0 && (
          <div className="mb-10">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Categorias relacionadas
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {relatedCategories.map((c) => (
                <Link
                  key={c.slug}
                  to={`/categoria/${c.slug}`}
                  className="group flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <span className="truncate">{c.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        {faqs.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              Perguntas frequentes
            </h3>
            <div className="space-y-3">
              {faqs.map((f, idx) => (
                <details
                  key={idx}
                  className={cn(
                    'group rounded-lg border bg-background p-4 transition-colors',
                    'open:border-primary/30 open:bg-primary/5',
                  )}
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-3 font-medium text-sm list-none">
                    <span>{f.q}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90 shrink-0" />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Canonical/SEO context for crawlers */}
        <link rel="canonical" href={`${SITE_BASE_URL}/categoria/${categorySlug}`} />
      </div>
    </section>
  );
};

export default CategorySeoBlock;
