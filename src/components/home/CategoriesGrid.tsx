import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, SearchX, Trophy } from 'lucide-react';
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

/** Emoji map for macro categories */
const MACRO_EMOJI: Record<string, string> = {
  'servicos-domesticos': '🏠',
  'servicos-tecnicos': '🛠️',
  'construcao-e-reforma': '🧱',
  'saude-e-estetica': '🩺',
  'transporte-e-logistica': '🚚',
  'alimentacao-e-eventos': '🍽️',
  'negocios-e-consultoria': '💼',
  'aulas-e-cursos': '📚',
  'consultoria-e-negocios': '💼',
  'eventos-e-festas': '🎉',
  'moda-e-beleza': '💇',
  'saude-e-bem-estar': '❤️',
  'automoveis-e-veiculos': '🚗',
  'assistencia-tecnica': '🔧',
};

const getMacroEmoji = (slug: string, name: string): string => {
  if (MACRO_EMOJI[slug]) return MACRO_EMOJI[slug];
  const n = name.toLowerCase();
  if (n.includes('urgên') || n.includes('urgenc')) return '🔥';
  if (n.includes('reform')) return '🏠';
  if (n.includes('consert')) return '🛠️';
  if (n.includes('saúde') || n.includes('saude') || n.includes('estétic')) return '🩺';
  if (n.includes('serviço') || n.includes('servico')) return '⚖️';
  return '📋';
};

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

  // Top 4 categories: prioritize key macros, then by count
  const topCategories = useMemo(() => {
    const prioritySlugs = ['construcao-e-reforma', 'assistencia-tecnica', 'automoveis-e-veiculos'];
    const priorityCats = prioritySlugs
      .map(s => categories.find(c => c.slug === s))
      .filter((c): c is CategoryItem => !!c);
    const remaining = [...subcategories]
      .filter(c => !prioritySlugs.includes(c.slug))
      .sort((a, b) => b.count - a.count);
    return [...priorityCats, ...remaining].slice(0, 4);
  }, [categories, subcategories]);

  // Visible items based on chip filter
  const visible = useMemo(() => {
    if (activeChip === ALL_CHIP) {
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
    const subParentIds = new Set(subcategories.map(s => s.parent_id));
    return macros.filter(m => subParentIds.has(m.id));
  }, [macros, subcategories]);

  const CategoryCard = ({ cat, featured = false }: { cat: CategoryItem; featured?: boolean }) => (
    <Link
      to={`/categoria/${cat.slug}`}
      className={`group relative flex flex-col items-center justify-center gap-2 rounded-3xl bg-card text-center shadow-[0_2px_12px_-2px_rgb(0_0_0/0.08)] transition-all duration-300 hover:shadow-[0_8px_24px_-4px_rgb(0_0_0/0.12)] hover:-translate-y-1 h-full ${
        featured ? 'min-h-[8rem] p-4' : 'min-h-[6.5rem] p-3'
      }`}
    >
      {/* Badge de quantidade */}
      {cat.count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-card">
          {cat.count > 99 ? '99+' : cat.count}
        </span>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-accent/0 to-primary/0 group-hover:from-accent/5 group-hover:to-primary/5 transition-all duration-500" />

      <span className={`relative flex items-center justify-center rounded-2xl bg-accent/10 group-hover:bg-accent/20 transition-colors duration-300 ${
        featured ? 'h-14 w-14' : 'h-12 w-12'
      }`}>
        <CategoryIcon icon={cat.icon} size={featured ? 30 : 26} className="text-accent" />
      </span>
      <span className={`relative font-bold leading-tight text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words w-full ${
        featured ? 'text-xs' : 'text-[0.6875rem]'
      }`} style={{ hyphens: 'auto' }}>
        {cat.name}
      </span>
    </Link>
  );

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
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-3xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Top Categories */}
            {topCategories.length >= 4 && activeChip === ALL_CHIP && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-accent" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Mais Buscadas
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {topCategories.map((cat, i) => (
                    <div key={cat.id} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                      <CategoryCard cat={cat} featured />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter Chips with Emojis */}
            {activeChips.length > 0 && (
              <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:justify-center">
                <button
                  onClick={() => setActiveChip(ALL_CHIP)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
                    activeChip === ALL_CHIP
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  ✨ Todos
                </button>
                {activeChips.map(macro => (
                  <button
                    key={macro.id}
                    onClick={() => setActiveChip(macro.id)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                      activeChip === macro.id
                        ? 'bg-accent text-accent-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {getMacroEmoji(macro.slug, macro.name)} {macro.name}
                  </button>
                ))}
              </div>
            )}

            {/* Grid */}
            {visible.length > 0 ? (
              <div
                key={activeChip}
                className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 auto-rows-fr"
              >
                {visible.map((cat, i) => (
                  <div key={cat.id} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}>
                    <CategoryCard cat={cat} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
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
              </div>
            )}

            <CategoriesViewAllButton />
          </>
        )}
      </div>
    </section>
  );
};

export default CategoriesGrid;
