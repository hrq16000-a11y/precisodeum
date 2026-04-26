import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, SearchX, Search } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon: string;
  parent_id?: string | null;
  count: number;
}

interface Props {
  categories: CategoryItem[];
  isLoading: boolean;
}

const ALL_CHIP = '__all__';

/** Full-width CTA button — text & bg from admin */
const CategoriesViewAllButton = () => {
  const { data } = useSiteSettings();
  const text = data?.values?.['categories_cta_text'] || 'Ver Todas as Categorias';
  const bg = data?.values?.['categories_cta_bg'] || '';

  return (
    <div className="mt-6">
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

// CSS-only animations — no framer-motion needed for this grid

const CategoriesGrid = ({ categories, isLoading }: Props) => {
  // Subcategories with providers, shuffled randomly (stable per mount)
  const visible = useMemo(() => {
    const subs = categories.filter(c => c.parent_id && c.count > 0);
    const a = [...subs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, 12);
  }, [categories]);

  const CategoryCard = ({ cat }: { cat: CategoryItem }) => (
    <Link
      to={`/categoria/${cat.slug}`}
      className="group relative flex flex-col items-center justify-center gap-2 rounded-3xl bg-card text-center shadow-[0_2px_12px_-2px_rgb(0_0_0/0.08)] transition-all duration-300 hover:shadow-[0_8px_24px_-4px_rgb(0_0_0/0.12)] hover:-translate-y-1 h-full min-h-[6.5rem] p-3"
    >
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-accent/0 to-primary/0 group-hover:from-accent/5 group-hover:to-primary/5 transition-all duration-500" />
      <span className="relative flex items-center justify-center rounded-2xl bg-accent/10 group-hover:bg-accent/20 transition-colors duration-300 h-12 w-12">
        <CategoryIcon icon={cat.icon} size={26} className="text-accent" />
      </span>
      <span className="relative font-bold leading-tight text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words w-full text-[0.6875rem]" style={{ hyphens: 'auto' }}>
        {cat.name}
      </span>
    </Link>
  );

  return (
    <section className="py-8 md:py-12 min-h-[420px]">
      <div className="container">
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent mb-2">
            <Search className="inline h-3.5 w-3.5 mr-1 -mt-0.5" /> Categorias
          </span>
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Encontre Profissionais por Categoria
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Escolha a categoria do serviço que você precisa
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="min-h-[6.5rem] rounded-3xl" />
            ))}
          </div>
        ) : visible.length > 0 ? (
          <>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 auto-rows-fr">
              {visible.map((cat) => (
                <div key={cat.id} className="animate-fade-in" style={{ animationFillMode: 'both' }}>
                  <CategoryCard cat={cat} />
                </div>
              ))}
            </div>
            <CategoriesViewAllButton />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
            <SearchX className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">Nenhuma categoria encontrada</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default CategoriesGrid;
