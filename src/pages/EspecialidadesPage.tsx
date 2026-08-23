import { useMemo, useState } from 'react';
import { Link } from '@/lib/router-compat';
import { motion } from 'framer-motion';
import { Search, Lightbulb, ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import CategoryIcon from '@/components/CategoryIcon';
import { useCategoriesWithCount } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { getExpertTips } from '@/lib/expertTips';

/**
 * /especialidades — Página pública SEO listando todas as categorias
 * com a primeira "Dica de Especialista" como introdução curta.
 * Cada card linka para /categoria/:slug, gerando link interno SEO para
 * os perfis daquela especialidade.
 */
const EspecialidadesPage = () => {
  const [search, setSearch] = useState('');
  const { data: categories = [], isLoading } = useCategoriesWithCount();

  useSeoHead({
    title: 'Especialidades de Profissionais | Preciso de um',
    description:
      'Conheça todas as especialidades disponíveis (Eletricista, Encanador, Pintor e mais). Dicas de especialista para escolher o profissional certo.',
    canonical: `${SITE_BASE_URL}/especialidades`,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = categories.filter((c) => c.count > 0);
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <section className="bg-hero py-12">
        <div className="container text-center">
          <h1 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">
            Especialidades de Profissionais
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-primary-foreground/80">
            Cada especialidade tem suas particularidades — confira a dica do nosso time e encontre o
            profissional ideal para o seu serviço.
          </p>
          <div className="mx-auto mt-5 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar especialidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
          </div>
        </div>
      </section>

      <main className="container flex-1 py-10">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((cat, i) => {
              const tips = getExpertTips(cat.slug);
              const intro = tips[0];
              return (
                <motion.article
                  key={cat.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4) }}
                >
                  <Link
                    to={`/categoria/${cat.slug}`}
                    className="group block h-full rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                  >
                    <header className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 transition-transform group-hover:scale-110">
                        <CategoryIcon icon={cat.icon} size={24} className="text-primary" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-display text-base font-bold text-foreground line-clamp-1">
                          {cat.name}
                        </h2>
                        <p className="text-[11px] text-muted-foreground">
                          {cat.count} profissional{cat.count !== 1 ? 'is' : ''} disponível
                          {cat.count !== 1 ? 'is' : ''}
                        </p>
                      </div>
                    </header>

                    <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-3">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <p className="text-xs leading-relaxed text-foreground/85">{intro}</p>
                      </div>
                    </div>

                    <footer className="mt-4 flex items-center justify-between text-xs font-semibold text-primary">
                      <span>Ver profissionais de {cat.name.toLowerCase()}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </footer>
                  </Link>
                </motion.article>
              );
            })}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma especialidade encontrada para "{search}".
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default EspecialidadesPage;
