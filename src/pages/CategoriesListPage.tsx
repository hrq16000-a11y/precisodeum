import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useCategoriesWithCount } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

const INITIAL = 12;
const MORE = 12;

const CategoriesListPage = () => {
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL);
  const { data: categories = [], isLoading } = useCategoriesWithCount();

  useSeoHead({
    title: 'Categorias de Serviços | Preciso de um',
    description: 'Todas as categorias de serviços profissionais disponíveis na plataforma.',
    canonical: `${SITE_BASE_URL}/categorias`,
  });

  const filtered = search.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <section className="bg-hero py-10">
        <div className="container text-center">
          <h1 className="font-display text-2xl font-bold text-primary-foreground md:text-4xl">
            Categorias de Serviços
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-primary-foreground/70">
            Escolha a categoria do serviço que você precisa
          </p>
          <div className="mx-auto mt-4 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="container flex-1 py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {visible.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/categoria/${cat.slug}`}
                  className="group flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary/30"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl text-primary">
                    {cat.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {cat.name}
                    </span>
                    {cat.count > 0 && (
                      <span className="text-xs text-muted-foreground">{cat.count} profissional(is)</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setVisibleCount((p) => p + MORE)}
                  className="rounded-lg border border-border bg-card px-6 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Ver Mais Categorias
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default CategoriesListPage;
