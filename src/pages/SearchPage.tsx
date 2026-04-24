import { useState, useMemo, useCallback, useEffect, lazy, Suspense, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SearchBar from '@/components/SearchBar';
import CategoryIcon from '@/components/CategoryIcon';
import ProviderCard from '@/components/ProviderCard';
import GeoLocationChip from '@/components/GeoLocationChip';
import GeoFallbackBanner from '@/components/GeoFallbackBanner';
import GeoFallbackNotice from '@/components/GeoFallbackNotice';
import GeoPromptBanner from '@/components/GeoPromptBanner';
import PaginationControls from '@/components/PaginationControls';
import EmptyStateFallback from '@/components/EmptyStateFallback';
import PriceEstimateWidget from '@/components/home/PriceEstimateWidget';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { useSearchProvidersGrouped, useCategories, useSearchSuggestions, useGeoCategories, normalizeCityName, matchesGeoContext, type DbProvider } from '@/hooks/useProviders';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useFeatureEnabled } from '@/hooks/useSiteSettings';
import { useGeoCity } from '@/hooks/useGeoCity';
import { Search, SlidersHorizontal, X, ArrowUpDown, MapPin, Building2, Phone, Globe, ChevronRight, Users, Navigation, Map as MapIcon, List, Circle, Zap } from 'lucide-react';
import { isInsideCorridor, type RouteCorridor } from '@/components/RouteSearchModal';
const RouteSearchModal = lazy(() => import('@/components/RouteSearchModal'));
import { calculateDistanceKm } from '@/lib/geoDistance';
import { applySearchFilters, countActiveFilters } from '@/lib/searchFilters';
import { useIsMobile } from '@/hooks/use-mobile';

const ProvidersMap = lazy(() => import('@/components/ProvidersMap'));
const SponsorAdSlot = lazy(() => import('@/components/ads/SponsorAdSlot'));
import PinnedSponsorCard from '@/components/sponsors/PinnedSponsorCard';
import PinnedSponsorSkeleton from '@/components/sponsors/PinnedSponsorSkeleton';
import ProviderCardSkeleton from '@/components/ProviderCardSkeleton';
import { usePinnedSponsor } from '@/hooks/usePinnedSponsor';
import UrgencyToggle from '@/components/home/UrgencyToggle';
import { useUrgencyMode } from '@/hooks/useUrgencyMode';
import { useOnlineProviders } from '@/hooks/useOnlinePresence';
import AskSystemDialog from '@/components/search/AskSystemDialog';
import { logSearchIntent } from '@/lib/searchIntent';

const ITEMS_PER_PAGE = 12;

type SortOption = 'relevance' | 'nearest' | 'rating' | 'reviews' | 'name_asc' | 'name_desc' | 'experience';

const SORT_CHIPS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'nearest', label: '📍 Mais Perto' },
  { value: 'rating', label: '⭐ Avaliação' },
  { value: 'reviews', label: 'Avaliações' },
  { value: 'experience', label: 'Experiência' },
];

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const query = searchParams.get('q') || '';
  const cityParam = searchParams.get('cidade') || '';
  const { city: geoCity, state: geoState, latitude: userLat, longitude: userLon, radiusKm, requestPreciseLocation, geoFailed, source: geoSource, lastKnownAt, dismissGeoFailure } = useGeoCity();
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [acceptingOnly, setAcceptingOnly] = useState(false);

  const [showOutOfState, setShowOutOfState] = useState(false);
  const [page, setPage] = useState(1);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [routeCorridor, setRouteCorridor] = useState<RouteCorridor | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');
  const { enabled: urgencyMode, setEnabled: setUrgencyMode } = useUrgencyMode();
  const onlineSet = useOnlineProviders();

  const effectiveCity = selectedCity || cityParam || geoCity || '';

  const { data: categories = [], isError: categoriesError } = useCategories();
  const { data: suggestions } = useSearchSuggestions();
  const { data: geoCategories = [] } = useGeoCategories(userLat, userLon);

  // Request GPS on mount for better proximity filtering
  useEffect(() => {
    requestPreciseLocation();
  }, [requestPreciseLocation]);

  const {
    data: grouped,
    isLoading,
    isError: searchError,
    refetch,
  } = useSearchProvidersGrouped(query, effectiveCity, selectedCategory, minRating, geoState || '', userLat, userLon, radiusKm);

  // Pinned (Categoria Exclusiva) sponsor — fica acima dos resultados
  const { data: pinnedSponsor, trackImpression: trackPinnedImpression, trackClick: trackPinnedClick } = usePinnedSponsor({
    categorySlug: selectedCategory || undefined,
    city: effectiveCity || undefined,
    state: geoState || undefined,
  });

  // Log search intent (powers FOMO demand alerts in provider dashboard)
  useEffect(() => {
    if (!selectedCategory && !query) return;
    const cat = categories.find((c) => c.slug === selectedCategory);
    logSearchIntent({
      categorySlug: selectedCategory || null,
      categoryName: cat?.name || query || null,
      city: effectiveCity || null,
      state: geoState || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, query, effectiveCity, geoState]);

  const localProviders = grouped?.local || [];
  const nearbyProviders = grouped?.nearby || [];
  const outOfStateProviders = grouped?.outOfState || [];
  const isFallback = grouped?.isFallback || false;

  // Combine for client-side filters
  const allProviders = useMemo(() => [...localProviders, ...nearbyProviders, ...outOfStateProviders], [localProviders, nearbyProviders, outOfStateProviders]);

  // Apply additional client-side filters
  const applyClientFilters = useCallback((list: DbProvider[]) => {
    return applySearchFilters(list, {
      selectedNeighborhood,
      businessNameFilter,
      phoneFilter,
      featuredFilter: featuredFilter as 'all' | 'featured' | 'normal',
      onlineOnly,
      acceptingOnly,
      sortBy,
      urgencyMode,
      onlineSet,
      routeCorridor: routeCorridor
        ? {
            midLat: routeCorridor.midLat,
            midLon: routeCorridor.midLon,
            isInside: (lat, lon) => isInsideCorridor(lat, lon, routeCorridor),
          }
        : null,
    }) as DbProvider[];
  }, [selectedNeighborhood, businessNameFilter, phoneFilter, featuredFilter, sortBy, routeCorridor, urgencyMode, onlineSet, onlineOnly, acceptingOnly]);

  const filteredLocal = useMemo(() => applyClientFilters(localProviders), [applyClientFilters, localProviders]);
  const filteredNearby = useMemo(() => applyClientFilters(nearbyProviders), [applyClientFilters, nearbyProviders]);
  const filteredOutOfState = useMemo(() => applyClientFilters(outOfStateProviders), [applyClientFilters, outOfStateProviders]);

  const fullyFiltered = [...filteredLocal, ...filteredNearby, ...filteredOutOfState];
  const nearestFiltered = filteredLocal.length > 0 ? filteredLocal[0] : (filteredNearby.length > 0 ? filteredNearby[0] : undefined);
  const nearestDistanceKm = nearestFiltered?.distanceKm;
  const nearestCity = nearestFiltered?.city;
  const totalDisplay = filteredLocal.length + filteredNearby.length + (showOutOfState ? filteredOutOfState.length : 0);

  const activeFilterCount = countActiveFilters({
    selectedCategory,
    selectedNeighborhood,
    businessNameFilter,
    phoneFilter,
    featuredFilter: featuredFilter as 'all' | 'featured' | 'normal',
    minRating,
    onlineOnly,
    acceptingOnly,
  });

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
    setOnlineOnly(false);
    setAcceptingOnly(false);
    setPage(1);
  }, []);

  // Unique cities & neighborhoods from results for autocomplete
  const availableCities = useMemo(() => {
    const cities = [...new Set(allProviders.map(p => p.city).filter(Boolean))];
    return cities.sort();
  }, [allProviders]);

  const availableNeighborhoods = useMemo(() => {
    let source = allProviders;
    if (effectiveCity) source = source.filter(p => p.city.toLowerCase() === effectiveCity.toLowerCase());
    const nbs = [...new Set(source.map(p => p.neighborhood).filter(Boolean))];
    return nbs.sort();
  }, [allProviders, effectiveCity]);

  // SEO — dynamic title/description/canonical reflecting active filters
  const seoCity = effectiveCity || '';
  const seoCategory = useMemo(() => {
    if (!selectedCategory) return '';
    return categories.find(c => c.slug === selectedCategory)?.name || '';
  }, [selectedCategory, categories]);

  const seoFilterParts: string[] = [];
  if (onlineOnly) seoFilterParts.push('online agora');
  if (acceptingOnly) seoFilterParts.push('aceitando clientes');
  if (sortBy === 'nearest') seoFilterParts.push('mais próximos');
  else if (sortBy === 'rating') seoFilterParts.push('melhor avaliados');
  const seoFilterSuffix = seoFilterParts.length ? ` (${seoFilterParts.join(', ')})` : '';

  const seoSubject = query
    ? `"${query}"`
    : seoCategory
      ? seoCategory
      : 'profissionais';

  const seoTitle = query || seoCategory
    ? `${query ? `Resultados para "${query}"` : `${seoCategory}`}${seoCity ? ` em ${seoCity}` : ''}${seoFilterSuffix}`
    : seoCity ? `Profissionais em ${seoCity}${seoFilterSuffix}` : 'Buscar Profissionais';

  const seoDesc = `Encontre ${seoSubject}${seoCity ? ` em ${seoCity}` : ' no Brasil'}${seoFilterSuffix}. ${totalDisplay > 0 ? `${totalDisplay} ${totalDisplay === 1 ? 'profissional disponível' : 'profissionais disponíveis'}.` : ''} Compare avaliações e solicite orçamentos.`.trim();

  // Build canonical with stable filter params (only meaningful ones)
  const canonicalUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (selectedCategory) params.set('categoria', selectedCategory);
    if (seoCity) params.set('cidade', seoCity);
    if (sortBy && sortBy !== 'relevance') params.set('ordem', sortBy);
    const qs = params.toString();
    return `${SITE_BASE_URL}/buscar${qs ? `?${qs}` : ''}`;
  }, [query, selectedCategory, seoCity, sortBy]);

  // Noindex when no meaningful query/category/city to avoid thin SERPs
  const noindex = !query && !selectedCategory && !seoCity;

  useSeoHead({ title: seoTitle, description: seoDesc, canonical: canonicalUrl, noindex });

  // JSON-LD ItemList of visible local providers (top 10)
  const jsonLdData = useMemo(() => {
    const items = filteredLocal.slice(0, 10).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_BASE_URL}/profissional/${p.slug}`,
      name: p.businessName || p.name,
    }));
    if (!items.length) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: seoTitle,
      description: seoDesc,
      numberOfItems: items.length,
      itemListElement: items,
    };
  }, [filteredLocal, seoTitle, seoDesc]);

  useJsonLd(jsonLdData);

  const paginatedLocal = filteredLocal.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const paginatedNearby = filteredNearby;
  const paginatedOutOfState = showOutOfState ? filteredOutOfState : [];

  // Quick suggestion chips
  const suggestionChips = useMemo(() => {
    return geoCategories.slice(0, 8).map(c => ({
      label: `${c.icon} ${c.name}`,
      type: 'categoria',
      value: c.slug,
    }));
  }, [geoCategories]);

  /* ── Filter form content (shared between sidebar & drawer) ── */
  const filterContent = (
    <div className="space-y-4">
      {/* Category */}
      <div>
        <Label className="text-xs text-muted-foreground">Categoria</Label>
        <Select value={selectedCategory || 'all'} onValueChange={v => { setSelectedCategory(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.slug}><span className="inline-flex items-center gap-1.5"><CategoryIcon icon={c.icon} size={14} /> {c.name}</span></SelectItem>
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
            {availableCities.map((c: string) => (
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
              {availableNeighborhoods.map((n: string) => (
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

      {/* Availability toggles */}
      <div>
        <Label className="text-xs text-muted-foreground">Disponibilidade</Label>
        <div className="mt-1.5 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => { setOnlineOnly(v => !v); setPage(1); }}
            className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
              onlineOnly
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'border-border bg-background text-muted-foreground hover:bg-muted'
            }`}
            aria-pressed={onlineOnly}
          >
            <span className="inline-flex items-center gap-1.5">
              <Circle className={`h-2 w-2 ${onlineOnly ? 'fill-emerald-500 text-emerald-500' : 'fill-muted-foreground/40 text-muted-foreground/40'}`} />
              Online agora
            </span>
            <span className="text-[10px] font-semibold">{onlineOnly ? 'ATIVO' : 'OFF'}</span>
          </button>
          <button
            type="button"
            onClick={() => { setAcceptingOnly(v => !v); setPage(1); }}
            className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
              acceptingOnly
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:bg-muted'
            }`}
            aria-pressed={acceptingOnly}
          >
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3 w-3" />
              Aceitando clientes
            </span>
            <span className="text-[10px] font-semibold">{acceptingOnly ? 'ATIVO' : 'OFF'}</span>
          </button>
        </div>
      </div>

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

      {/* Sort — only in desktop sidebar */}
      {!isMobile && (
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3" /> Ordenar por
          </Label>
          <Select value={sortBy} onValueChange={v => { setSortBy(v as SortOption); setPage(1); }}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevância</SelectItem>
              <SelectItem value="nearest">📍 Mais Perto</SelectItem>
              <SelectItem value="rating">Melhor avaliação</SelectItem>
              <SelectItem value="reviews">Mais avaliações</SelectItem>
              <SelectItem value="experience">Mais experiência</SelectItem>
              <SelectItem value="name_asc">Nome A–Z</SelectItem>
              <SelectItem value="name_desc">Nome Z–A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Route search */}
      <div className="pt-3 mt-3 border-t border-border">
        <Button
          variant={routeCorridor ? 'accent' : 'outline'}
          size="sm"
          className="w-full text-xs gap-1.5"
          onClick={() => { routeCorridor ? setRouteCorridor(null) : setRouteModalOpen(true); if (isMobile) setDrawerOpen(false); }}
        >
          <Navigation className="h-3.5 w-3.5" />
          {routeCorridor ? 'Limpar rota Casa→Trabalho' : 'Buscar no caminho Casa→Trabalho'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      
      {/* Search header with gradient background */}
      <section className="relative bg-gradient-to-b from-muted/80 to-background pb-2 pt-4 sm:pt-6 overflow-x-clip">
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="container relative">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 sm:mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex-1"><SearchBar variant="compact" /></div>
            <GeoLocationChip />
          </motion.div>

          {/* Modo Urgência — só renderiza se houver online na região */}
          <div className="mb-3 sm:mb-4">
            <UrgencyToggle
              enabled={urgencyMode}
              onToggle={setUrgencyMode}
              cityOverride={effectiveCity}
              variant="inline"
            />
          </div>

        {/* Quick category chips */}
        {!query && suggestionChips.length > 0 && (
          <div className="mb-3 sm:mb-4 flex flex-wrap gap-1.5 sm:gap-2">
            {suggestionChips.map(chip => (
              <Badge
                key={chip.value}
                variant={selectedCategory === chip.value ? 'default' : 'outline'}
                className="cursor-pointer text-xs transition-all hover:scale-105"
                onClick={() => { setSelectedCategory(selectedCategory === chip.value ? '' : chip.value); setPage(1); }}
              >
                {chip.label}
              </Badge>
            ))}
          </div>
        )}
        </div>
      </section>

      <div className="container py-4 sm:py-6">
        {/* Mobile: Sort chips + filter/route buttons */}
        {isMobile && (
          <div className="mb-3 space-y-2">
            {/* Sort chips — horizontal scroll */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {SORT_CHIPS.map(chip => (
                <button
                  key={chip.value}
                  onClick={() => { setSortBy(chip.value); setPage(1); }}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    sortBy === chip.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            {/* Filter + Route buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs gap-1.5"
                onClick={() => setDrawerOpen(true)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 ml-1">{activeFilterCount}</Badge>
                )}
              </Button>
              <Button
                variant={routeCorridor ? 'accent' : 'outline'}
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => routeCorridor ? setRouteCorridor(null) : setRouteModalOpen(true)}
              >
                <Navigation className="h-3.5 w-3.5" />
                {routeCorridor ? 'Limpar Rota' : 'Casa→Trabalho'}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row">
          {/* Filters sidebar — desktop only */}
          {!isMobile && (
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

                <div className={`${showFilters ? '' : 'hidden lg:block'}`}>
                  {filterContent}
                </div>
              </div>
            </aside>
          )}

          {/* Mobile filter drawer */}
          {isMobile && (
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
              <DrawerContent className="max-h-[85vh]">
                <DrawerHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <DrawerTitle className="flex items-center gap-2 text-sm">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filtros
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5">{activeFilterCount}</Badge>
                      )}
                    </DrawerTitle>
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs h-7 px-2">
                        <X className="h-3 w-3 mr-1" /> Limpar tudo
                      </Button>
                    )}
                  </div>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-6">
                  {filterContent}
                </div>
                <div className="border-t p-3">
                  <Button className="w-full" size="sm" onClick={() => setDrawerOpen(false)}>
                    Ver {totalDisplay} resultado{totalDisplay !== 1 ? 's' : ''}
                  </Button>
                </div>
              </DrawerContent>
            </Drawer>
          )}

          {/* Results */}
          <div className="flex-1">
            <GeoPromptBanner />

            {/* Price Estimate Widget */}
            {selectedCategory && (() => {
              const cat = categories.find(c => c.slug === selectedCategory);
              return cat ? (
                <div className="mb-4">
                  <PriceEstimateWidget categorySlug={cat.slug} categoryName={cat.name} city={effectiveCity} />
                </div>
              ) : null;
            })()}
            {(categoriesError || searchError) && (
              <div className="mb-4 rounded-xl border border-border bg-card p-3 sm:p-4 text-sm text-muted-foreground">
                Falha temporária ao carregar dados.{' '}
                <a
                  href="/ajuda"
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Acionar suporte
                </a>
              </div>
            )}

            <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {isLoading ? 'Buscando...' : `${totalDisplay} profissional(is) encontrado(s)`}
                {query && <> para "<span className="font-semibold text-foreground">{query}</span>"</>}
                {effectiveCity && <> em <span className="font-semibold text-foreground">{effectiveCity}</span></>}
              </p>
              <div className="flex items-center gap-2">
                {!isFallback && filteredLocal.length > 0 && effectiveCity && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-medium text-primary">
                    <MapPin className="h-3 w-3" />
                    {filteredLocal.length} na sua região
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setViewMode(v => v === 'list' ? 'map' : 'list')}
                >
                  {viewMode === 'list' ? <><MapIcon className="h-3.5 w-3.5" /> Mapa</> : <><List className="h-3.5 w-3.5" /> Lista</>}
                </Button>
              </div>
            </div>

            {geoFailed && (
              <GeoFallbackNotice
                city={geoCity}
                source={geoSource}
                lastKnownAt={lastKnownAt}
                onRetry={() => {
                  try { sessionStorage.removeItem('geo_browser_asked'); } catch {}
                  void requestPreciseLocation();
                  dismissGeoFailure();
                }}
                onDismiss={dismissGeoFailure}
              />
            )}

            {isFallback && effectiveCity && (
              <GeoFallbackBanner
                originalCity={effectiveCity}
                expansionLevel="all"
                stateName={geoState || undefined}
                resultCount={fullyFiltered.length}
                nearestDistanceKm={nearestDistanceKm}
                nearestCity={nearestCity}
              />
            )}

            {!isFallback && nearestDistanceKm != null && nearestDistanceKm > 50 && (
              <GeoFallbackBanner
                originalCity={effectiveCity}
                expansionLevel="all"
                stateName={geoState || undefined}
                resultCount={filteredLocal.length}
                nearestDistanceKm={nearestDistanceKm}
                nearestCity={nearestCity}
              />
            )}

            {/* Active filter tags */}
            {activeFilterCount > 0 && (
              <div className="mb-3 sm:mb-4 flex flex-wrap gap-1.5 sm:gap-2">
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
                {onlineOnly && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" /> Online agora
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setOnlineOnly(false)} />
                  </Badge>
                )}
                {acceptingOnly && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Zap className="h-3 w-3" /> Aceitando clientes
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setAcceptingOnly(false)} />
                  </Badge>
                )}
              </div>
            )}

            {routeCorridor && (
              <div className="mb-3 rounded-lg bg-accent/10 border border-accent/20 px-3 py-2 text-xs text-accent font-medium flex items-center gap-2">
                <Navigation className="h-3.5 w-3.5" />
                Mostrando profissionais no trajeto Casa → Trabalho
              </div>
            )}

            {/* Map View */}
            {viewMode === 'map' && !isLoading && (
              <Suspense fallback={<Skeleton className="h-[60vh] rounded-xl" />}>
                <ProvidersMap
                  providers={fullyFiltered}
                  userLat={userLat}
                  userLon={userLon}
                  className="mb-4"
                />
              </Suspense>
            )}

            {isLoading ? (
              <>
                <PinnedSponsorSkeleton />
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  <ProviderCardSkeleton count={4} />
                </div>
              </>
            ) : (
              <>
                {/* Pinned (Categoria Exclusiva) — primeiro resultado, identificado como Patrocinado */}
                {pinnedSponsor && (
                  <PinnedSponsorCard
                    sponsor={pinnedSponsor}
                    onImpression={trackPinnedImpression}
                    onClick={trackPinnedClick}
                  />
                )}

                {/* Local results grid */}
                {paginatedLocal.length > 0 && (
                  <>
                    {effectiveCity && !isFallback && filteredLocal.length > 0 && (
                      <div className="mb-3 flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold text-primary">
                          Na sua região (até {radiusKm}km)
                        </span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <motion.div
                      className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2"
                      initial="hidden"
                      animate="show"
                      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
                    >
                      {paginatedLocal.map((p, idx) => (
                        <Fragment key={p.id}>
                          <motion.div
                            variants={{ hidden: { opacity: 0, y: 16, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1 } }}
                            transition={{ duration: 0.35 }}
                            layout
                          >
                            <ProviderCard provider={p} isFallback={isFallback} />
                          </motion.div>
                          {/* Inject sponsor ad every 5 results */}
                          {(idx + 1) % 5 === 0 && (
                            <motion.div
                              variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                              className="col-span-full"
                            >
                              <Suspense fallback={null}>
                                <SponsorAdSlot locationKey="search-inline" layout="card" maxAds={1} />
                              </Suspense>
                            </motion.div>
                          )}
                        </Fragment>
                      ))}
                    </motion.div>
                  </>
                )}

                {/* Nearby cities section (same state / <100km) */}
                {paginatedNearby.length > 0 && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-6 sm:mt-8 mb-3 flex items-center gap-3"
                    >
                      <div className="h-px flex-1 bg-border" />
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        Cidades próximas ({filteredNearby.length})
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </motion.div>
                    <motion.div
                      className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2"
                      initial="hidden"
                      animate="show"
                      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
                    >
                      {paginatedNearby.map((p) => (
                        <motion.div
                          key={p.id}
                          variants={{ hidden: { opacity: 0, y: 16, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1 } }}
                          transition={{ duration: 0.35 }}
                          layout
                        >
                          <ProviderCard provider={p} isFallback={isFallback} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </>
                )}

                {/* Out of state — collapsed by default */}
                {filteredOutOfState.length > 0 && !showOutOfState && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 sm:mt-10 flex justify-center"
                  >
                    <button
                      onClick={() => { setShowOutOfState(true); setPage(1); }}
                      className="group relative inline-flex items-center gap-2 sm:gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 px-4 py-3 sm:px-6 sm:py-4 text-sm font-semibold text-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/40 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                        <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <span className="text-left">
                        <span className="block text-xs sm:text-sm font-semibold">Profissionais de outro estado ({filteredOutOfState.length})</span>
                        <span className="block text-[11px] sm:text-xs text-muted-foreground">
                          Deseja ver? Ver mais...
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </button>
                  </motion.div>
                )}

                {showOutOfState && paginatedOutOfState.length > 0 && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-6 sm:mt-8 mb-3 flex items-center gap-3"
                    >
                      <div className="h-px flex-1 bg-border" />
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        Outro estado ({filteredOutOfState.length})
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </motion.div>
                    <motion.div
                      className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2"
                      initial="hidden"
                      animate="show"
                      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
                    >
                      {paginatedOutOfState.map((p) => (
                        <motion.div
                          key={p.id}
                          variants={{ hidden: { opacity: 0, y: 16, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1 } }}
                          transition={{ duration: 0.35 }}
                          layout
                        >
                          <ProviderCard provider={p} isFallback={true} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </>
                )}

                {totalDisplay === 0 && (
                  <EmptyStateFallback
                    title="Nenhum profissional encontrado"
                    message="Tente alterar os filtros ou buscar por outro termo."
                  />
                )}

                {/* "Pergunte e Compare" — sem leilão */}
                <div className="mt-6 flex justify-center">
                  <AskSystemDialog
                    defaultService={query}
                    defaultCategory={selectedCategory}
                  />
                </div>
                <PaginationControls currentPage={page} totalItems={totalDisplay} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPage} />
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
      <Suspense fallback={null}>
        <RouteSearchModal open={routeModalOpen} onOpenChange={setRouteModalOpen} onRouteReady={setRouteCorridor} />
      </Suspense>
    </div>
  );
};

export default SearchPage;
