/**
 * CategoryCityPage — `/categoria/:slug/em/:cidade`
 *
 * Página SEO programática que combina categoria + cidade. Existe para:
 *  1. Indexar páginas long-tail ("eletricista em curitiba") com title/description
 *     próprios e canonical estável.
 *  2. Listar profissionais filtrados por categoria E cidade (string match
 *     normalizado) com link direto para o perfil.
 *  3. Linkar internamente para `/buscar?q=...&cidade=...` (busca com filtros)
 *     e para o perfil de cada profissional via `/profissional/:slug`.
 *
 * Comportamento de fallback (SEO seguro):
 *  - Slug inválido / categoria ausente → noindex.
 *  - Cidade não reconhecida (não está no índice de cidades) → noindex.
 *  - Sem resultados → renderiza CTA de busca ampliada (sem 404 hard).
 *
 * IMPORTANTE: Esta rota NÃO altera lógica de busca; apenas reusa
 * `useCategoryProviders` + filtragem cliente-side por cidade. Todo o ranking
 * vem do hook (mesmo do CategoryPage).
 */
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, MapPin, Search, Users } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Breadcrumbs from '@/components/Breadcrumbs';
import ProviderCard from '@/components/ProviderCard';
import EmptyStateFallback from '@/components/EmptyStateFallback';
import { Button } from '@/components/ui/button';
import { useSeoHead } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useCategoryProviders } from '@/hooks/useProviders';
import { isKnownCity } from '@/lib/citiesIndex';
import { normalize } from '@/lib/normalize';
import { buildCanonicalUrl } from '@/lib/canonicalUrl';

function humanizeSlug(slug: string | undefined): string {
  if (!slug) return '';
  return slug
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export default function CategoryCityPage() {
  const { slug, cidade } = useParams<{ slug: string; cidade: string }>();
  const { data: payload, isLoading } = useCategoryProviders(slug || '');
  const category = payload?.category;
  const allProviders = (payload?.providers || []) as any[];

  const cityHuman = humanizeSlug(cidade);
  const categoryHuman = category?.name || humanizeSlug(slug);
  const cityKnown = useMemo(() => (cidade ? isKnownCity(cityHuman) : false), [cidade, cityHuman]);

  // Filtragem por cidade — match normalizado (acentos, case).
  const providers = useMemo(() => {
    if (!cidade) return [];
    const target = normalize(cityHuman);
    return allProviders.filter((p) => {
      const pc = normalize(p?.city || '');
      return pc === target;
    });
  }, [allProviders, cidade, cityHuman]);

  const valid = !!category && !!cidade && cityKnown;
  const title = valid
    ? `${categoryHuman} em ${cityHuman} — Profissionais Verificados | Preciso de Um`
    : 'Categoria ou cidade inválida | Preciso de Um';
  const description = valid
    ? `${providers.length} profissionais de ${categoryHuman.toLowerCase()} em ${cityHuman}. Avaliações reais e contato direto pelo WhatsApp. Encontre o ideal para o seu serviço.`
    : 'Esta combinação de categoria/cidade não está disponível. Veja outras opções no diretório.';

  const canonical = valid
    ? buildCanonicalUrl(`/categoria/${slug}/em/${cidade}`)
    : undefined;

  useSeoHead({
    title,
    description,
    canonical,
    noindex: !valid || providers.length === 0,
  });

  // JSON-LD ItemList apenas quando há resultados — evita lixo nos motores.
  useJsonLd(
    valid && providers.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `${categoryHuman} em ${cityHuman}`,
          numberOfItems: providers.length,
          itemListElement: providers.slice(0, 20).map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: buildCanonicalUrl(`/profissional/${p.slug || p.id}`),
            name: p.business_name || p.full_name || categoryHuman,
          })),
        }
      : null,
    `category-city-${slug}-${cidade}`,
  );

  const breadcrumbs = useMemo(
    () => [
      { label: 'Início', url: '/' },
      { label: 'Categorias', url: '/categorias' },
      ...(category
        ? [{ label: categoryHuman, url: `/categoria/${category.slug}` }]
        : []),
      ...(cityKnown ? [{ label: cityHuman, url: `/categoria/${slug}/em/${cidade}` }] : []),
    ],
    [category, categoryHuman, cityHuman, cityKnown, slug, cidade],
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-screen-xl px-4 py-6 space-y-6">
        <Breadcrumbs items={breadcrumbs} />

        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            {valid ? (
              <>
                {categoryHuman} em <span className="text-primary">{cityHuman}</span>
              </>
            ) : (
              'Categoria ou cidade não encontrada'
            )}
          </h1>
          {valid && (
            <p className="text-sm text-muted-foreground max-w-2xl">
              {providers.length > 0
                ? `${providers.length} ${providers.length === 1 ? 'profissional verificado' : 'profissionais verificados'} de ${categoryHuman.toLowerCase()} em ${cityHuman}.`
                : `Ainda não temos profissionais de ${categoryHuman.toLowerCase()} cadastrados em ${cityHuman}. Tente uma busca mais ampla.`}
            </p>
          )}
        </motion.header>

        {/* Atalhos de busca / cross-link interno (relevância SEO) */}
        {valid && (
          <nav
            aria-label="Atalhos de busca"
            className="flex flex-wrap gap-2 text-xs"
          >
            <Link
              to={`/buscar?q=${encodeURIComponent(categoryHuman)}&cidade=${encodeURIComponent(cityHuman)}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:bg-accent"
            >
              <Search className="h-3 w-3" /> Buscar {categoryHuman} em {cityHuman}
            </Link>
            <Link
              to={`/categoria/${category!.slug}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:bg-accent"
            >
              <ChevronRight className="h-3 w-3" /> Ver todos os {categoryHuman}
            </Link>
            <Link
              to={`/cidades/${(cidade || '').toLowerCase()}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:bg-accent"
            >
              <MapPin className="h-3 w-3" /> Outras categorias em {cityHuman}
            </Link>
          </nav>
        )}

        {!valid ? (
          <EmptyStateFallback
            title="Página não disponível"
            message="Verifique a URL ou volte para o diretório de categorias."
          />
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando profissionais…</p>
        ) : providers.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum profissional cadastrado nessa cidade ainda. Tente uma busca mais ampla:
            </p>
            <Button asChild size="sm">
              <Link to={`/buscar?q=${encodeURIComponent(categoryHuman)}`}>
                <Search className="h-4 w-4 mr-1" /> Buscar {categoryHuman} em todo o Brasil
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((p) => (
              <li key={p.id}>
                <ProviderCard provider={p as any} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <Footer />
    </div>
  );
}
