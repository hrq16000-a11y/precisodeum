import { useState, useMemo } from 'react';
import { Link } from '@/lib/router-compat';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, MapPin } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { useCategoriesWithCount } from '@/hooks/useProviders';
import { useCategoriesInRegion } from '@/hooks/useCategoriesInRegion';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

const INITIAL = 12;
const MORE = 12;

const CategoriesListPage = () => {
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL);
  const { city: geoCity, state: geoState } = useGeoCity();
  const [cityFilter, setCityFilter] = useState<string>('');
  const { data: categories = [], isLoading } = useCategoriesWithCount();

  const activeCity = cityFilter || null;
  const { data: regional, isLoading: loadingRegion } = useCategoriesInRegion(
    activeCity,
    activeCity ? geoState : null,
  );

  const cityLabel = activeCity || '';

  useSeoHead({
    title: cityLabel
      ? `Categorias de Serviços em ${cityLabel} | Preciso de um`
      : 'Categorias de Serviços | Preciso de um',
    description: cityLabel
      ? `Veja as categorias de serviços com profissionais disponíveis em ${cityLabel} e as categorias abertas para novos prestadores e patrocinadores.`
      : 'Todas as categorias de serviços profissionais disponíveis na plataforma.',
    canonical: `${SITE_BASE_URL}/categorias`,
  });

  const shuffled = useMemo(() => {
    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    return shuffle(categories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]);

  const filtered = search.trim()
    ? shuffled.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : shuffled;

  // Quando há filtro de cidade, "com prestador" passa a ser o conjunto regional.
  const regionalIds = useMemo(
    () => new Set((regional?.items || []).map((c) => c.id)),
    [regional],
  );
  // Só restringimos ao conjunto regional quando o hook realmente resolveu a cidade.
  // Caso contrário (cidade não encontrada, texto parcial, fallback estado/global),
  // mantemos o critério padrão de contagem para não esvaziar a lista.
  const useRegionalSplit = !!activeCity && !loadingRegion && regional?.scope === 'city';

  const matchesProviders = (c: { id: string; count: number }) =>
    useRegionalSplit ? regionalIds.has(c.id) : c.count > 0;

  const withProviders = filtered.filter(matchesProviders);
  const withoutProviders = filtered.filter((c) => !matchesProviders(c));



  const visible = withProviders.slice(0, visibleCount);
  const hasMore = visibleCount < withProviders.length;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <section className="bg-hero py-10">
        <div className="container text-center">
          <h1 className="font-display text-2xl font-bold text-primary-foreground md:text-4xl">
            Categorias de Serviços{cityLabel ? ` em ${cityLabel}` : ''}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-primary-foreground/70">
            Escolha a categoria do serviço que você precisa
          </p>
          <div className="mx-auto mt-4 grid max-w-2xl gap-2 sm:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrar por cidade..."
                value={cityFilter}
                onChange={(e) => { setCityFilter(e.target.value); setVisibleCount(INITIAL); }}
                className="pl-9 bg-card"
              />
            </div>
          </div>
          {geoCity && !cityFilter && (
            <button
              type="button"
              onClick={() => setCityFilter(geoCity)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-semibold text-primary-foreground"
            >
              <MapPin className="h-3 w-3" /> Ver só {geoCity}
            </button>
          )}
          {cityFilter && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-primary-foreground/80">
              {loadingRegion ? <span>Carregando {cityFilter}...</span> : <span>Exibindo resultados de {cityFilter}</span>}
              <button
                type="button"
                onClick={() => setCityFilter('')}
                className="rounded-full bg-primary-foreground/10 px-2 py-0.5 font-semibold text-primary-foreground"
              >
                limpar
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="container flex-1 py-8">
        {isLoading ? (
          <div className="grid gap-[0.75rem]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="min-h-[3.5rem] rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <motion.div
              className="grid gap-[0.75rem]"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))' }}
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
            >
              {visible.map((cat) => (
                <motion.div
                  key={cat.id}
                  variants={{ hidden: { opacity: 0, y: 16, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1 } }}
                  transition={{ duration: 0.35 }}
                >
                  <Link
                    to={`/categoria/${cat.slug}`}
                    className="group relative flex items-center gap-[0.625rem] rounded-3xl border border-border/50 bg-card p-[0.75rem] shadow-[0_2px_12px_-2px_rgb(0_0_0/0.08)] transition-all duration-300 hover:shadow-[0_8px_24px_-4px_rgb(0_0_0/0.12)] hover:-translate-y-0.5 hover:border-primary/30 overflow-hidden min-h-[3.5rem]"
                  >
                    {/* Badge de quantidade */}
                    {cat.count > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white shadow-xs ring-2 ring-card">
                        {cat.count > 99 ? '99+' : cat.count}
                      </span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.03] to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                    <span className="relative flex min-h-[2.5rem] min-w-[2.5rem] h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                      <CategoryIcon icon={cat.icon} size={22} className="text-primary" />
                    </span>
                    <div className="relative min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2 break-words" style={{ hyphens: 'auto' }}>
                        {cat.name}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>

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

            {withoutProviders.length > 0 && (
              <div className="mt-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Categorias abertas — seja o primeiro
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid gap-[0.75rem]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))' }}>
                  {withoutProviders.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/categoria/${cat.slug}`}
                      className="group flex items-center gap-[0.625rem] rounded-xl border border-dashed border-primary/30 bg-card/60 p-[0.75rem] min-h-[3.5rem] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card"
                    >
                      <span className="flex min-h-[2.5rem] min-w-[2.5rem] h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 transition-transform duration-300 group-hover:scale-110">
                        <CategoryIcon icon={cat.icon} size={22} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs sm:text-sm font-semibold leading-tight text-foreground/80 group-hover:text-primary transition-colors line-clamp-2 break-words" style={{ hyphens: 'auto' }}>
                          {cat.name}
                        </span>
                        <p className="text-[10px] leading-tight text-muted-foreground/80 mt-0.5">
                          Vaga aberta · cadastre-se ou patrocine
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
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
