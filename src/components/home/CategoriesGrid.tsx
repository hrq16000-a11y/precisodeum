import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon: string;
  count: number;
}

interface Props {
  categories: CategoryItem[];
  isLoading: boolean;
}

const HOME_COUNT = 6;

const CategoriesGrid = ({ categories, isLoading }: Props) => {
  // Prioritize categories with providers, then randomize, show only 6
  const visible = useMemo(() => {
    if (!categories.length) return [];
    const withProviders = categories.filter(c => c.count > 0);
    const withoutProviders = categories.filter(c => c.count === 0);
    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    return [...shuffle(withProviders), ...shuffle(withoutProviders)].slice(0, HOME_COUNT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]);

  return (
    <section className="py-8">
      <div className="container">
        <div className="mb-6 text-center">
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Encontre Profissionais por Categoria
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Escolha a categoria do serviço que você precisa
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {visible.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/categoria/${cat.slug}`}
                  className="group flex items-center gap-2 rounded-xl border border-border bg-card p-2.5 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary/30"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base text-primary">
                    {cat.icon}
                  </span>
                  <span className="min-w-0 flex-1 text-xs font-semibold leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2 sm:text-sm">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-4 text-center">
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to="/categorias">
                  Ver Todas as Categorias
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default CategoriesGrid;
