import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Lightbulb, ChevronRight, HelpCircle, ChevronDown } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import ProviderCardSkeleton from '@/components/ProviderCardSkeleton';
import CategoryIcon from '@/components/CategoryIcon';
import { Button } from '@/components/ui/button';
import { useCategoryProviders } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { getExpertTips } from '@/lib/expertTips';

/**
 * /especialidades/:slug — Página pública SEO de uma especialidade.
 * Estrutura otimizada para Long Tail:
 *  - H1 com nome da especialidade
 *  - Bloco "Dicas de Especialista" (H2 + H3 + parágrafos)
 *  - Top profissionais relevantes (mesma fonte de useCategoryProviders, ordenado por rating)
 *  - Breadcrumbs JSON-LD
 *  - CTA para /buscar?categoria=:slug com a lógica completa de ranking
 */
const EspecialidadeDetailPage = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data, isLoading } = useCategoryProviders(slug);
  const category = data?.category;
  const providers = data?.providers ?? [];

  const tips = useMemo(() => getExpertTips(slug), [slug]);
  const displayName = category?.name || slug.replace(/-/g, ' ');
  const top = providers.slice(0, 6);

  useSeoHead({
    title: category
      ? `${displayName}: Dicas de Especialista e Profissionais`
      : 'Especialidade | Preciso de um',
    description: category
      ? `Encontre os melhores profissionais de ${displayName.toLowerCase()} no Brasil. Dicas de especialista, avaliações e contato direto via WhatsApp.`
      : 'Especialidade não encontrada.',
    canonical: `${SITE_BASE_URL}/especialidades/${slug}`,
    noindex: !category,
  });

  // JSON-LD: Breadcrumbs + ItemList dos top profissionais (boost SEO)
  useJsonLd(
    category
      ? {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_BASE_URL },
                { '@type': 'ListItem', position: 2, name: 'Especialidades', item: `${SITE_BASE_URL}/especialidades` },
                { '@type': 'ListItem', position: 3, name: displayName, item: `${SITE_BASE_URL}/especialidades/${slug}` },
              ],
            },
            {
              '@type': 'ItemList',
              name: `Profissionais de ${displayName}`,
              itemListElement: top.map((p: any, idx: number) => ({
                '@type': 'ListItem',
                position: idx + 1,
                url: `${SITE_BASE_URL}/profissional/${p.slug || p.id}`,
                name: p.businessName || p.name,
              })),
            },
          ],
        }
      : null,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Breadcrumbs visíveis */}
      <nav aria-label="Navegação" className="container pt-4">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <li><Link to="/" className="hover:text-primary">Início</Link></li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li><Link to="/especialidades" className="hover:text-primary">Especialidades</Link></li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li className="font-medium text-foreground" aria-current="page">{displayName}</li>
        </ol>
      </nav>

      <header className="container mt-4 rounded-2xl bg-gradient-to-br from-primary/10 via-card to-accent/5 p-6 md:p-8">
        <div className="flex items-start gap-4">
          {category?.icon && (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <CategoryIcon icon={category.icon} size={28} className="text-primary" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold capitalize text-foreground md:text-3xl">
              {displayName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {providers.length} profissional{providers.length !== 1 ? 'is' : ''} disponível
              {providers.length !== 1 ? 'is' : ''} — escolha pelos critérios que importam para você.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to={`/buscar?categoria=${slug}`}>
                  Buscar profissionais agora
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={`/categoria/${slug}`}>Ver categoria completa</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container flex-1 py-8">
        {/* Dicas de Especialista — bloco rico para SEO de cauda longa */}
        <section aria-labelledby="dicas-heading" className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-accent" />
            <h2 id="dicas-heading" className="font-display text-xl font-bold text-foreground">
              Dicas de Especialista
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {tips.map((tip, i) => (
              <article
                key={i}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <h3 className="text-sm font-semibold text-foreground">Dica {i + 1}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{tip}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Profissionais relevantes */}
        <section aria-labelledby="top-heading">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="top-heading" className="font-display text-xl font-bold text-foreground">
              Profissionais mais relevantes
            </h2>
            {top.length > 0 && (
              <Link
                to={`/buscar?categoria=${slug}`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver todos
              </Link>
            )}
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <ProviderCardSkeleton key={i} />)}
            </div>
          ) : top.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Ainda não temos profissionais cadastrados nesta especialidade.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-4">
                <Link to="/especialidades">Ver outras especialidades</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {top.map((p: any) => (
                <ProviderCard key={p.id} provider={p} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default EspecialidadeDetailPage;
