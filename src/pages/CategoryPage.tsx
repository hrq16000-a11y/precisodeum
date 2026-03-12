import { useParams } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoryProviders } from '@/hooks/useProviders';

const CategoryPage = () => {
  const { slug } = useParams();
  const { data, isLoading } = useCategoryProviders(slug || '');

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

  if (!data?.category) {
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

  const { category, providers } = data;

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
          {providers.map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
        {providers.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">Nenhum profissional nesta categoria ainda.</p>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CategoryPage;
