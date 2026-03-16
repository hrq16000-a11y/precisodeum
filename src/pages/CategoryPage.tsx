import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import PaginationControls from '@/components/PaginationControls';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoryProviders } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';

const ITEMS_PER_PAGE = 12;

const CategoryPage = () => {
  const { slug } = useParams();
  const { data, isLoading } = useCategoryProviders(slug || '');
  const [page, setPage] = useState(1);

  const category = data?.category;
  const providers = data?.providers || [];

  useSeoHead({
    title: category ? `${category.name} - Profissionais` : 'Categoria',
    description: category
      ? `Encontre os melhores profissionais de ${category.name}. ${providers.length} cadastrados com avaliações verificadas.`
      : 'Encontre profissionais por categoria.',
    canonical: slug ? `${SITE_BASE_URL}/categoria/${slug}` : undefined,
  });

  const breadcrumbLd = useMemo(() => category ? ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: category.name },
    ],
  }) : null, [category]);

  useJsonLd(breadcrumbLd);

  const paginatedProviders = providers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <section className="bg-hero py-12">
          <div className="container text-center">
            <Skeleton className="mx-auto h-10 w-10 rounded-full" />
            <Skeleton className="mx-auto mt-3 h-8 w-48" />
          </div>
        </section>
        <div className="container py-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container flex flex-1 items-center justify-center py-20">
          <p className="text-lg text-muted-foreground">Categoria não encontrada.</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <section className="bg-hero py-12">
        <div className="container text-center">
          <span className="text-4xl">{category.icon}</span>
          <h1 className="mt-3 font-display text-3xl font-bold text-primary-foreground md:text-4xl">
            {category.name}
          </h1>
          <p className="mt-2 text-primary-foreground/70">
            {providers.length} profissional(is) cadastrado(s)
          </p>
        </div>
      </section>
      <div className="container py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedProviders.map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
        {providers.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">Nenhum profissional nesta categoria ainda.</p>
        )}
        <PaginationControls currentPage={page} totalItems={providers.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />
      </div>
      <Footer />
    </div>
  );
};

export default CategoryPage;
