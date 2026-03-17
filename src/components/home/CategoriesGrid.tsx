import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
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

const INITIAL_COUNT = 12;
const LOAD_MORE_COUNT = 12;

const CategoriesGrid = ({ categories, isLoading }: Props) => {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  // Prioritize categories with providers, then randomize
  const shuffled = useMemo(() => {
    if (!categories.length) return [];
    const withProviders = categories.filter(c => c.count > 0);
    const withoutProviders = categories.filter(c => c.count === 0);
    // Shuffle each group
    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    return [...shuffle(withProviders), ...shuffle(withoutProviders)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]);

  const visible = shuffled.slice(0, visibleCount);
  const hasMore = visibleCount < shuffled.length;

  return (
    <section className="py-10">
      <div className="container">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
            Encontre Profissionais por Categoria
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha a categoria do serviço que você precisa
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
                  className="group flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary/30"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg text-primary">
                    {cat.icon}
                  </span>
                  <span className="min-w-0 flex-1 text-xs font-semibold leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2 sm:text-sm">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 text-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setVisibleCount(prev => prev + LOAD_MORE_COUNT)}
                  className="gap-2"
                >
                  <ChevronDown className="h-4 w-4" />
                  Ver Mais Categorias
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default CategoriesGrid;
