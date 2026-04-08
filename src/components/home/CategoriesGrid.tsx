import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
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

const HOME_COUNT_DESKTOP = 8;

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } },
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
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 text-center"
        >
          <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent mb-2">
            🔍 Categorias
          </span>
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Encontre Profissionais por Categoria
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Escolha a categoria do serviço que você precisa
          </p>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <motion.div
              variants={container}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="grid grid-cols-2 gap-3 md:grid-cols-4"
            >
              {visible.map((cat) => (
                <motion.div key={cat.id} variants={item}>
                  <Link
                    to={`/categoria/${cat.slug}`}
                    className="group relative flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1.5 hover:border-accent/40 overflow-hidden text-center"
                  >
                    {/* Hover gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/0 to-primary/0 group-hover:from-accent/5 group-hover:to-primary/5 transition-all duration-500 rounded-2xl" />
                    
                    {/* Accent bar top */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent/0 to-transparent group-hover:via-accent transition-all duration-500" />
                    
                    <motion.span
                      className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 text-2xl group-hover:from-primary/15 group-hover:to-accent/15 transition-colors duration-300"
                      whileHover={{ scale: 1.15, rotate: 8 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    >
                      {cat.icon}
                    </motion.span>
                    <div className="relative">
                      <span className="block text-sm font-bold leading-tight text-foreground group-hover:text-accent transition-colors line-clamp-2">
                        {cat.name}
                      </span>
                      {cat.count > 0 && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mt-1.5 inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent"
                        >
                          {cat.count} {cat.count === 1 ? 'profissional' : 'profissionais'}
                        </motion.span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="mt-6 text-center"
            >
              <Button variant="outline" size="sm" className="gap-1.5 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors" asChild>
                <Link to="/categorias">
                  Ver Todas as Categorias
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </Button>
            </motion.div>
          </>
        )}
      </div>
    </section>
  );
};

export default CategoriesGrid;
