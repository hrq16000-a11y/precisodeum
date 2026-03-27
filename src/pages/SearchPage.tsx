import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SearchBar from '@/components/SearchBar';
import ProviderCard from '@/components/ProviderCard';
import GeoLocationChip from '@/components/GeoLocationChip';
import PaginationControls from '@/components/PaginationControls';
import GeoFallbackBanner from '@/components/GeoFallbackBanner';
import EmptyStateFallback from '@/components/EmptyStateFallback';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchProviders, useCategories, filterAndRankProviders } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useFeatureEnabled } from '@/hooks/useSiteSettings';
import { useGeoCity } from '@/hooks/useGeoCity';

const ITEMS_PER_PAGE = 12;

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const city = searchParams.get('cidade') || '';
  const { city: geoCity, state: geoState } = useGeoCity();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [minRating, setMinRating] = useState(0);
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');
  const [page, setPage] = useState(1);

  const effectiveCity = city || geoCity || '';

  const { data: categories = [], isError: categoriesError } = useCategories();
  const {
    data: filtered = [],
    isLoading,
    isError: searchError,
    refetch,
  } = useSearchProviders(query, effectiveCity, selectedCategory, minRating);

  // --- Geo Fallback: expand to state then all when city yields 0 ---
  const baseProviders = useSearchProviders(query, '', selectedCategory, minRating).data || [];

  const { fallbackResults, expansionLevel } = useMemo(() => {
    if (filtered.length > 0 || !effectiveCity || isLoading) {
      return { fallbackResults: [], expansionLevel: null };
    }

    // Level 2: same state
    const userState = geoState || '';
    if (userState) {
      const stateResults = filterAndRankProviders(baseProviders, '', '', '', 0)
        .filter((p) => p.state.toLowerCase() === userState.toLowerCase());
      if (stateResults.length > 0) {
        return { fallbackResults: stateResults, expansionLevel: 'state' as const };
      }
    }

    // Level 3: all results
    if (baseProviders.length > 0) {
      return { fallbackResults: baseProviders, expansionLevel: 'all' as const };
    }

    return { fallbackResults: [], expansionLevel: null };
  }, [filtered, effectiveCity, isLoading, baseProviders, geoState]);

  const displayResults = filtered.length > 0 ? filtered : fallbackResults;
  const isFallback = filtered.length === 0 && fallbackResults.length > 0;

  const seoCity = effectiveCity || '';
  const seoTitle = query
    ? `Resultados para "${query}"${seoCity ? ` em ${seoCity}` : ''}`
    : seoCity ? `Profissionais em ${seoCity}` : 'Buscar Profissionais';
  const seoDesc = query
    ? `Encontre profissionais para "${query}"${seoCity ? ` em ${seoCity}` : ''}. Compare avaliações e solicite orçamentos.`
    : seoCity
      ? `Encontre profissionais confiáveis em ${seoCity}. Compare avaliações e solicite orçamentos.`
      : 'Busque e encontre profissionais confiáveis perto de você na maior plataforma de serviços do Brasil.';
  useSeoHead({ title: seoTitle, description: seoDesc, canonical: `${SITE_BASE_URL}/buscar` });

  const paginatedResults = displayResults.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1"><SearchBar variant="compact" /></div>
          <GeoLocationChip />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-60">
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
              <h3 className="mb-3 text-sm font-bold text-foreground">Filtros</h3>
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Categoria</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>
              {reviewsEnabled && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Avaliação mínima</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                    value={minRating}
                    onChange={(e) => { setMinRating(Number(e.target.value)); setPage(1); }}
                  >
                    <option value={0}>Todas</option>
                    <option value={4}>4+ estrelas</option>
                    <option value={4.5}>4.5+ estrelas</option>
                  </select>
                </div>
              )}
            </div>
          </aside>

          <div className="flex-1">
            {(categoriesError || searchError) && (
              <div className="mb-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Falha temporária ao carregar dados.{' '}
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Tentar novamente
                </button>
              </div>
            )}
            <p className="mb-4 text-sm text-muted-foreground">
              {isLoading ? 'Buscando...' : `${displayResults.length} profissional(is) encontrado(s)`}
              {query && <> para "<span className="font-semibold text-foreground">{query}</span>"</>}
              {effectiveCity && !isFallback && <> em <span className="font-semibold text-foreground">{effectiveCity}</span></>}
            </p>

            {isFallback && expansionLevel && (
              <GeoFallbackBanner
                originalCity={effectiveCity}
                expansionLevel={expansionLevel}
                stateName={geoState || undefined}
                resultCount={fallbackResults.length}
              />
            )}

            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {paginatedResults.map((p) => (
                    <ProviderCard key={p.id} provider={p} isFallback={isFallback} />
                  ))}
                </div>
                {displayResults.length === 0 && (
                  <EmptyStateFallback
                    title="Nenhum profissional encontrado"
                    message="Tente alterar os filtros ou buscar por outro termo."
                  />
                )}
                <PaginationControls currentPage={page} totalItems={displayResults.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SearchPage;
