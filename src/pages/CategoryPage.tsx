import { useParams } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import { categories, providers } from '@/data/mockData';

const CategoryPage = () => {
  const { slug } = useParams();
  const category = categories.find((c) => c.slug === slug);
  const categoryProviders = providers.filter((p) => p.categorySlug === slug);

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
            {category.count.toLocaleString('pt-BR')} profissionais cadastrados
          </p>
        </div>
      </section>
      <div className="container py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoryProviders.map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
        {categoryProviders.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">Nenhum profissional nesta categoria ainda.</p>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CategoryPage;
