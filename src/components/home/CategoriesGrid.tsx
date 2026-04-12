import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, SearchX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
};

const CategoriesGrid = ({ categories, isLoading }: Props) => {
  const [activeChip, setActiveChip] = useState(ALL_CHIP);

  // Derive macro categories (parent_id IS NULL) that have subcategories with providers
  const macros = useMemo(() => {
    if (!categories.length) return [];
    return categories.filter(c => !c.parent_id);
  }, [categories]);

  // Subcategories (those with parent_id set)
  const subcategories = useMemo(() => {
    return categories.filter(c => c.parent_id && c.count > 0);
  }, [categories]);

  // Visible items based on chip filter
  const visible = useMemo(() => {
    if (activeChip === ALL_CHIP) {
      // Show subcategories with providers, shuffled
      const arr = [...subcategories];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr.slice(0, 9);
    }
    return subcategories.filter(c => c.parent_id === activeChip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChip, subcategories.length]);

  // Chips that have at least one subcategory with providers
  const activeChips = useMemo(() => {
    const subParentIds = new Set(subcategories.map(c => c.parent_id));
    return macros.filter(m => subParentIds.has(m.id));
  }, [macros, subcategories]);

  return (
    <section className="py-8 md:py-12">
      <div className="container">
        <div className="mb-6 text-center">
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
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Filter Chips */}
            {activeChips.length > 0 && (
              <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:justify-center">
                <button
                  onClick={() => setActiveChip(ALL_CHIP)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    activeChip === ALL_CHIP
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Todos
                </button>
                {activeChips.map(macro => (
                  <button
                    key={macro.id}
                    onClick={() => setActiveChip(macro.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                      activeChip === macro.id
                        ? 'bg-accent text-accent-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {macro.name}
                  </button>
                ))}
              </div>
            )}

            {/* Grid */}
            <AnimatePresence mode="wait">
              {visible.length > 0 ? (
                <motion.div
                  key={activeChip}
                  className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 auto-rows-fr"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {visible.map(cat => (
                    <motion.div key={cat.id} variants={itemVariants}>
                      <Link
                        to={`/categoria/${cat.slug}`}
                        className="group relative flex flex-col items-center justify-center gap-2 rounded-2xl bg-card p-3 text-center shadow-[0_4px_6px_-1px_rgb(0_0_0/0.1)] transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full min-h-[6.5rem]"
                      >
                        {/* Hover overlay */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/0 to-primary/0 group-hover:from-accent/5 group-hover:to-primary/5 transition-all duration-500" />

                        <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 group-hover:bg-sky-100 transition-colors duration-300">
                          <CategoryIcon icon={cat.icon} size={26} />
                        </span>
                        <span className="relative text-[0.6875rem] font-bold leading-tight text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words w-full" style={{ hyphens: 'auto' }}>
                          {cat.name}
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <SearchX className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">Nenhuma categoria encontrada</p>
                  <a
                    href="https://wa.me/5500000000000?text=Gostaria%20de%20sugerir%20uma%20categoria"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-foreground transition-transform hover:scale-105"
                  >
                    Sugerir Categoria
                  </a>
                </motion.div>
              )}
            </AnimatePresence>

            <CategoriesViewAllButton />
          </>
        )}
      </div>
    </section>
  );
};

export default CategoriesGrid;
