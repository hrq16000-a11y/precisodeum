import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { useSiteSettings } from '@/hooks/useSiteSettings';

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

const HOME_COUNT_DESKTOP = 8;

/** Full-width CTA button — text & bg from admin */
const CategoriesViewAllButton = () => {
  const { data } = useSiteSettings();
  const text = data?.values?.['categories_cta_text'] || 'Ver Todas as Categorias';
  const bg = data?.values?.['categories_cta_bg'] || '';

  return (
    <div className="mt-6 animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
      <Link
        to="/categorias"
        className={`group flex w-full items-center justify-between rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${!bg ? 'bg-accent/5 border border-accent/10' : ''}`}
        style={bg ? { backgroundColor: bg } : undefined}
      >
        <span className="text-sm font-bold text-foreground">{text}</span>
        <ChevronRight className="h-4 w-4 text-accent transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  );
};


const CategoriesGrid = ({ categories, isLoading }: Props) => {
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
    return [...shuffle(withProviders), ...shuffle(withoutProviders)].slice(0, HOME_COUNT_DESKTOP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]);

  return (
    <section className="py-12">
      <div className="container">
        <div className="mb-8 text-center animate-fade-in">
          <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent mb-2">
            🔍 Categorias
          </span>
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Encontre Profissionais por Categoria
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Escolha a categoria do serviço que você precisa
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {visible.map((cat, i) => (
                <div
                  key={cat.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${0.1 + i * 0.06}s`, animationFillMode: 'both' }}
                >
                  <Link
                    to={`/categoria/${cat.slug}`}
                    className="group relative flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-accent/40 overflow-hidden text-center"
                  >
                    {/* Hover gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/0 to-primary/0 group-hover:from-accent/5 group-hover:to-primary/5 transition-all duration-500 rounded-2xl" />

                    {/* Accent bar top */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent/0 to-transparent group-hover:via-accent transition-all duration-500" />

                    <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 group-hover:bg-sky-100 transition-all duration-300">
                      <CategoryIcon icon={cat.icon} size={28} />
                    </span>
                    <div className="relative">
                      <span className="block text-sm font-bold leading-tight text-foreground group-hover:text-accent transition-colors line-clamp-2">
                        {cat.name}
                      </span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            <CategoriesViewAllButton />
          </>
        )}
      </div>
    </section>
  );
};

export default CategoriesGrid;
