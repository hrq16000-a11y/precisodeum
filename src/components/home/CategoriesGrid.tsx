import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, SearchX, Search } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettingValue, useSiteSettings } from '@/hooks/useSiteSettings';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useCategoriesInRegion } from '@/hooks/useCategoriesInRegion';
import { useAuth } from '@/hooks/useAuth';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon: string;
  parent_id?: string | null;
  count: number;
}

interface Props {
  // Mantido por compatibilidade (Index.tsx ainda passa), mas agora usamos hook próprio
  categories?: CategoryItem[];
  isLoading?: boolean;
}

// Constantes de layout — mantidas em sync entre skeleton e grid real
const VISIBLE_COUNT = 6; // 3 colunas x 2 linhas no mobile
const CARD_MIN_H = 'min-h-[6.5rem]';
/** Hash determinístico simples (DJB2) para derivar seed estável de uma string */
function hashSeed(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

const normalizeKey = (value?: string | null) =>
  (value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export type CategoriesRotationStrategy = 'daily' | 'session' | 'fixed';

const SESSION_SEED_KEY = 'pdu:cats:session-seed';

/** Pega (ou cria) uma seed estável durante toda a sessão do navegador. */
function getOrCreateSessionSeed(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const cached = window.sessionStorage.getItem(SESSION_SEED_KEY);
    if (cached) {
      const n = Number(cached);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const seed = Math.floor(Math.random() * 2_147_483_647) || 1;
    window.sessionStorage.setItem(SESSION_SEED_KEY, String(seed));
    return seed;
  } catch {
    return Math.floor(Math.random() * 2_147_483_647) || 1;
  }
}

/**
 * Gera a seed de embaralhamento das categorias respeitando a estratégia
 * configurada pelo admin em `home_categories_rotation_strategy`:
 *  - 'daily'   → mesma ordem por dia + cidade/UF (default).
 *  - 'session' → nova ordem por aba/sessão do navegador.
 *  - 'fixed'   → seed = 0 → ordem original (alfabética da query).
 */
export function getStableShuffleSeed(
  userId?: string | null,
  city?: string | null,
  state?: string | null,
  dateKeyOrStrategy?: string,
  strategy: CategoriesRotationStrategy = 'daily',
): number {
  if (strategy === 'fixed') return 0;
  if (strategy === 'session') return getOrCreateSessionSeed();
  const day = dateKeyOrStrategy || new Date().toISOString().slice(0, 10);
  const region = `${normalizeKey(city)}|${normalizeKey(state)}` || 'br';
  const who = userId ? `u:${userId}` : 'anon';
  return hashSeed(`pdu:cats:${day}:${region}:${who}`);
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

const CategoryCard = ({ cat }: { cat: CategoryItem }) => (
  <Link
    to={`/categoria/${cat.slug}`}
    className={`group relative flex flex-col items-center justify-center gap-2 rounded-3xl bg-card text-center shadow-[0_2px_12px_-2px_rgb(0_0_0/0.08)] transition-all duration-300 hover:shadow-[0_8px_24px_-4px_rgb(0_0_0/0.12)] hover:-translate-y-1 h-full ${CARD_MIN_H} p-3`}
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

const CategoriesGrid = (_props: Props) => {
  const geo = useGeoCity();
  const { user } = useAuth();
  const { data, isLoading } = useCategoriesInRegion(geo.city, geo.state);

  const items = data?.items || [];
  const scope = data?.scope;

  const rotationStrategyRaw = useSettingValue('home_categories_rotation_strategy');
  const strategy: CategoriesRotationStrategy =
    rotationStrategyRaw === 'session' || rotationStrategyRaw === 'fixed' ? rotationStrategyRaw : 'daily';

  const visible = useMemo(() => {
    const subs = items.filter((c) => c.parent_id);
    const pool = subs.length >= VISIBLE_COUNT ? subs : items;
    const seed = getStableShuffleSeed(user?.id, geo.city, geo.state, undefined, strategy);
    if (strategy === 'fixed' || seed === 0) return pool.slice(0, VISIBLE_COUNT);
    return seededShuffle(pool, seed).slice(0, VISIBLE_COUNT);
  }, [items, user?.id, geo.city, geo.state, strategy]);

  const gridCls = 'grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 auto-rows-fr';

  return (
    <section className="py-8 md:py-12 min-h-[600px] md:min-h-[520px]">
      <div className="container">
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent mb-2">
            <Search className="inline h-3.5 w-3.5 mr-1 -mt-0.5" /> Categorias
          </span>
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Encontre Profissionais por Categoria
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {scope === 'city' && geo.city
              ? `Profissionais ativos em ${geo.city}`
              : scope === 'state' && geo.state
              ? `Profissionais ativos em ${geo.state}`
              : 'Escolha a categoria do serviço que você precisa'}
          </p>
        </div>

        {isLoading ? (
          <div className={gridCls} aria-hidden="true">
            {Array.from({ length: VISIBLE_COUNT }).map((_, i) => (
              <Skeleton key={i} className={`${CARD_MIN_H} rounded-3xl`} />
            ))}
          </div>
        ) : visible.length > 0 ? (
          <>
            <div className={gridCls}>
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
