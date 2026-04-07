import { useMemo, useRef, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import FadeInSection from '@/components/FadeInSection';
import MagneticButton from '@/components/MagneticButton';

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

const HOME_COUNT_MOBILE = 6;
const HOME_COUNT_DESKTOP = 8;

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
    <section className="py-10">
      <div className="container">
        <FadeInSection className="mb-6 text-center">
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Encontre Profissionais por Categoria
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Escolha a categoria do serviço que você precisa
          </p>
        </FadeInSection>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {visible.map((cat, i) => (
                <FadeInSection key={cat.id} delay={i * 0.05}>
                  <Link
                    to={`/categoria/${cat.slug}`}
                    className="group relative flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/30 overflow-hidden text-center"
                  >
                    <span className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-accent/5 transition-all duration-500" />
                    <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary/15">
                      {cat.icon}
                    </span>
                    <div className="relative">
                      <span className="block text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {cat.name}
                      </span>
                      {cat.count > 0 && (
                        <span className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                          {cat.count} {cat.count === 1 ? 'profissional' : 'profissionais'}
                        </span>
                      )}
                    </div>
                  </Link>
                </FadeInSection>
              ))}
            </div>

            <FadeInSection delay={0.3} className="mt-5 text-center">
              <Button variant="outline" size="sm" className="gap-1.5 rounded-full" asChild>
                <Link to="/categorias">
                  Ver Todas as Categorias
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </Button>
            </FadeInSection>
          </>
        )}
      </div>
    </section>
  );
};

export default CategoriesGrid;
