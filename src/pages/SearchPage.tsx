import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SearchBar from '@/components/SearchBar';
import ProviderCard from '@/components/ProviderCard';
import GeoLocationChip from '@/components/GeoLocationChip';
import PaginationControls from '@/components/PaginationControls';
import EmptyStateFallback from '@/components/EmptyStateFallback';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSearchProviders, useCategories, useSearchSuggestions } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useFeatureEnabled } from '@/hooks/useSiteSettings';
import { useGeoCity } from '@/hooks/useGeoCity';
import { Search, SlidersHorizontal, X, ArrowUpDown, MapPin, Building2, Phone } from 'lucide-react';

const ITEMS_PER_PAGE = 12;

type SortOption = 'relevance' | 'rating' | 'reviews' | 'name_asc' | 'name_desc' | 'experience';

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const cityParam = searchParams.get('cidade') || '';
  const { city: geoCity, state: geoState } = useGeoCity();
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('categoria') || '');
  const [selectedCity, setSelectedCity] = useState(cityParam);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(searchParams.get('bairro') || '');
  const [businessNameFilter, setBusinessNameFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [featuredFilter, setFeaturedFilter] = useState('all');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');

  const effectiveCity = selectedCity || cityParam || geoCity || '';

  const { data: categories = [], isError: categoriesError } = useCategories();
  const { data: suggestions } = useSearchSuggestions();
  const {
    data: filtered = [],
    isLoading,
    isError: searchError,
    refetch,
  } = useSearchProviders(query, effectiveCity, selectedCategory, minRating);

  // Apply additional client-side filters
  const fullyFiltered = useMemo(() => {
    let results = [...filtered];

    if (selectedNeighborhood) {
      const nb = selectedNeighborhood.toLowerCase();
      results = results.filter(p => p.neighborhood.toLowerCase().includes(nb));
    }

    if (businessNameFilter) {
      const bn = businessNameFilter.toLowerCase();
      results = results.filter(p =>
        (p.businessName?.toLowerCase().includes(bn)) ||
        p.name.toLowerCase().includes(bn)
      );
    }

    if (phoneFilter) {
      const ph = phoneFilter.replace(/\D/g, '');
      if (ph) {
        results = results.filter(p =>
          p.phone.includes(ph) || p.whatsapp.includes(ph)
        );
      }
    }

    if (featuredFilter === 'featured') {
      results = results.filter(p => p.featured);
    } else if (featuredFilter === 'normal') {
      results = results.filter(p => !p.featured);
    }

    // Sort
    if (sortBy !== 'relevance') {
      results.sort((a, b) => {
        switch (sortBy) {
          case 'rating': return b.rating - a.rating;
          case 'reviews': return b.reviewCount - a.reviewCount;
          case 'name_asc': return a.name.localeCompare(b.name);
          case 'name_desc': return b.name.localeCompare(a.name);
          case 'experience': return b.yearsExperience - a.yearsExperience;
          default: return 0;
        }
      });
    }

    return results;
  }, [filtered, selectedNeighborhood, businessNameFilter, phoneFilter, featuredFilter, sortBy]);

  const activeFilterCount = [selectedCategory, selectedNeighborhood, businessNameFilter, phoneFilter, featuredFilter !== 'all' ? 'x' : '', minRating > 0 ? 'x' : ''].filter(Boolean).length;

  const clearAllFilters = useCallback(() => {
    setSelectedCategory('');
    setSelectedCity('');
    setSelectedNeighborhood('');
    setBusinessNameFilter('');
    setPhoneFilter('');
    setStatusFilter('all');
    setFeaturedFilter('all');
    setMinRating(0);
    setSortBy('relevance');
    setPage(1);
  }, []);

  // Unique cities & neighborhoods from results for autocomplete
  const availableCities = useMemo(() => {
    const cities = [...new Set(filtered.map(p => p.city).filter(Boolean))];
    return cities.sort();
  }, [filtered]);

  const availableNeighborhoods = useMemo(() => {
    let source = filtered;
    if (effectiveCity) source = source.filter(p => p.city.toLowerCase() === effectiveCity.toLowerCase());
    const nbs = [...new Set(source.map(p => p.neighborhood).filter(Boolean))];
    return nbs.sort();
  }, [filtered, effectiveCity]);

  // SEO
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

  const paginatedResults = fullyFiltered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Quick suggestion chips
  const suggestionChips = useMemo(() => {
    const chips: { label: string; type: string; value: string }[] = [];
    (suggestions?.categories || []).slice(0, 6).forEach(c => {
      chips.push({ label: c.name, type: 'categoria', value: c.slug });
    });
    return chips;
  }, [suggestions]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container py-6">
        {/* Search bar + Geo */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1"><SearchBar variant="compact" /></div>
          <GeoLocationChip />
        </div>

        {/* Quick category chips */}
        {!query && suggestionChips.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {suggestionChips.map(chip => (
              <Badge
                key={chip.value}
                variant={selectedCategory === chip.value ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => { setSelectedCategory(selectedCategory === chip.value ? '' : chip.value); setPage(1); }}
              >
                {chip.label}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Filters sidebar */}
          <aside className="w-full shrink-0 lg:w-64">
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5">{activeFilterCount}</Badge>
                  )}
                </h3>
                <div className="flex items-center gap-1">
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs h-7 px-2">
                      <X className="h-3 w-3 mr-1" /> Limpar
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="lg:hidden h-7 px-2" onClick={() => setShowFilters(!showFilters)}>
                    {showFilters ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>
              </div>

              <div className={`space-y-4 ${showFilters ? '' : 'hidden lg:block'}`}>
                {/* Category */}
                <div>
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <Select value={selectedCategory || 'all'} onValueChange={v => { setSelectedCategory(v === 'all' ? '' : v); setPage(1); }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.slug}>{c.icon} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* City */}
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Cidade
                  </Label>
                  <Select value={selectedCity || 'all'} onValueChange={v => { setSelectedCity(v === 'all' ? '' : v); setSelectedNeighborhood(''); setPage(1); }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as cidades</SelectItem>
                      {availableCities.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Neighborhood */}
                {availableNeighborhoods.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Bairro</Label>
                    <Select value={selectedNeighborhood || 'all'} onValueChange={v => { setSelectedNeighborhood(v === 'all' ? '' : v); setPage(1); }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os bairros</SelectItem>
                        {availableNeighborhoods.map(n => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Business Name */}
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Nome da empresa
                  </Label>
                  <Input
                    className="mt-1"
                    placeholder="Buscar por empresa..."
                    value={businessNameFilter}
                    onChange={e => { setBusinessNameFilter(e.target.value); setPage(1); }}
                  />
                </div>

                {/* Phone/WhatsApp */}
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Telefone / WhatsApp
                  </Label>
                  <Input
                    className="mt-1"
                    placeholder="DDD + número..."
                    value={phoneFilter}
                    onChange={e => { setPhoneFilter(e.target.value); setPage(1); }}
                  />
                </div>

                {/* Featured */}
                <div>
                  <Label className="text-xs text-muted-foreground">Destaque</Label>
                  <Select value={featuredFilter} onValueChange={v => { setFeaturedFilter(v); setPage(1); }}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="featured">⭐ Destaques</SelectItem>
                      <SelectItem value="normal">Normais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Rating */}
                {reviewsEnabled && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Avaliação mínima</Label>
                    <Select value={String(minRating)} onValueChange={v => { setMinRating(Number(v)); setPage(1); }}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Todas</SelectItem>
                        <SelectItem value="3">3+ estrelas</SelectItem>
                        <SelectItem value="4">4+ estrelas</SelectItem>
                        <SelectItem value="4.5">4.5+ estrelas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Sort */}
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" /> Ordenar por
                  </Label>
                  <Select value={sortBy} onValueChange={v => { setSortBy(v as SortOption); setPage(1); }}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevância</SelectItem>
                      <SelectItem value="rating">Melhor avaliação</SelectItem>
                      <SelectItem value="reviews">Mais avaliações</SelectItem>
                      <SelectItem value="experience">Mais experiência</SelectItem>
                      <SelectItem value="name_asc">Nome A–Z</SelectItem>
                      <SelectItem value="name_desc">Nome Z–A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </aside>

          {/* Results */}
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

            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {isLoading ? 'Buscando...' : `${fullyFiltered.length} profissional(is) encontrado(s)`}
                {query && <> para "<span className="font-semibold text-foreground">{query}</span>"</>}
                {effectiveCity && <> em <span className="font-semibold text-foreground">{effectiveCity}</span></>}
              </p>
            </div>

            {/* Active filter tags */}
            {activeFilterCount > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {selectedCategory && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Cat: {categories.find(c => c.slug === selectedCategory)?.name || selectedCategory}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategory('')} />
                  </Badge>
                )}
                {selectedNeighborhood && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Bairro: {selectedNeighborhood}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedNeighborhood('')} />
                  </Badge>
                )}
                {businessNameFilter && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Empresa: {businessNameFilter}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setBusinessNameFilter('')} />
                  </Badge>
                )}
                {phoneFilter && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Tel: {phoneFilter}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setPhoneFilter('')} />
                  </Badge>
                )}
                {featuredFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    {featuredFilter === 'featured' ? '⭐ Destaques' : 'Normais'}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFeaturedFilter('all')} />
                  </Badge>
                )}
                {minRating > 0 && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    {minRating}+ ⭐
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setMinRating(0)} />
                  </Badge>
                )}
              </div>
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
                    <ProviderCard key={p.id} provider={p} isFallback={false} />
                  ))}
                </div>
                {fullyFiltered.length === 0 && (
                  <EmptyStateFallback
                    title="Nenhum profissional encontrado"
                    message="Tente alterar os filtros ou buscar por outro termo."
                  />
                )}
                <PaginationControls currentPage={page} totalItems={fullyFiltered.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />
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
