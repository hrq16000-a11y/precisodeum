import { useState, useMemo, useCallback, useEffect, lazy, Suspense, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from '@/lib/router-compat';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SearchBar from '@/components/SearchBar';
import CategoryIcon from '@/components/CategoryIcon';
import ProviderCard from '@/components/ProviderCard';
import ProviderRenderer from '@/components/cards/ProviderRenderer';
import GeoLocationChip from '@/components/GeoLocationChip';
import GeoFallbackBanner from '@/components/GeoFallbackBanner';
import GeoFallbackNotice from '@/components/GeoFallbackNotice';
import GeoPromptBanner from '@/components/GeoPromptBanner';
import PaginationControls from '@/components/PaginationControls';
import EmptyStateFallback from '@/components/EmptyStateFallback';
import SearchEmptyState from '@/components/SearchEmptyState';
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
import { useFeatureEnabled, useSettingValue } from '@/hooks/useSiteSettings';
import { useGeoCity } from '@/hooks/useGeoCity';
import { Search, SlidersHorizontal, X, ArrowUpDown, MapPin, Building2, Phone, Globe, ChevronRight, Users, Navigation, Map as MapIcon, List, Circle, Zap, ArrowRight, RefreshCcw, Star, Compass, Award, Trophy, GraduationCap, Sparkles } from 'lucide-react';
import { isInsideCorridor, type RouteCorridor } from '@/components/RouteSearchModal';
const RouteSearchModal = lazy(() => import('@/components/RouteSearchModal'));
import { calculateDistanceKm } from '@/lib/geoDistance';
import { applySearchFilters, countActiveFilters, DEFAULT_SCORE_WEIGHTS, type SearchScoreWeights } from '@/lib/searchFilters';
import { useProviderConversionScores } from '@/hooks/useProviderConversionScores';
import { BUCKET_MULTIPLIER, applyDiversityCap } from '@/lib/conversionSignals';
import { useIsMobile } from '@/hooks/use-mobile';

const ProvidersMap = lazy(() => import('@/components/ProvidersMap'));
const SponsorAdSlot = lazy(() => import('@/components/ads/SponsorAdSlot'));
import PinnedSponsorCard from '@/components/sponsors/PinnedSponsorCard';
import PinnedSponsorSkeleton from '@/components/sponsors/PinnedSponsorSkeleton';
import ProviderCardSkeleton from '@/components/ProviderCardSkeleton';
import ProgressIndicator from '@/components/motion/ProgressIndicator';
import { usePinnedSponsor } from '@/hooks/usePinnedSponsor';
import UrgencyToggle from '@/components/home/UrgencyToggle';
import { useUrgencyMode } from '@/hooks/useUrgencyMode';
import { useOnlineProviders, useRecentlyOfflineSet, useRealtimeHealth } from '@/hooks/useOnlinePresence';
import { useActiveTodayProviders } from '@/hooks/useActiveTodayProviders';
import AskSystemDialog from '@/components/search/AskSystemDialog';
import ScoreTooltipBadge from '@/components/search/ScoreTooltipBadge';
import { logSearchIntent } from '@/lib/searchIntent';
import { safeUF } from '@/lib/locationFormat';
import CepLookupField from '@/components/CepLookupField';
import { lookupCep, normalizeCep, formatCep } from '@/lib/cepLookup';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 12;

type SortOption = 'relevance' | 'best' | 'nearest' | 'rating' | 'reviews' | 'name_asc' | 'name_desc' | 'experience';

const SORT_CHIPS: { value: SortOption; label: string; icon: typeof Star }[] = [
  { value: 'relevance', label: 'Relevância', icon: Trophy },
  { value: 'best', label: 'Melhor combinação', icon: Sparkles },
  { value: 'nearest', label: 'Mais perto', icon: Compass },
  { value: 'rating', label: 'Avaliação', icon: Star },
  { value: 'reviews', label: 'Avaliações', icon: Award },
  { value: 'experience', label: 'Experiência', icon: GraduationCap },
];

/** Texto curto do critério ativo, exibido no badge da UI. */
const SORT_CRITERIA_HINT: Record<SortOption, string> = {
  relevance: 'Padrão do site',
  best: 'Rating + proximidade',
  nearest: 'Distância (km)',
  rating: 'Maior avaliação',
  reviews: 'Mais avaliações',
  experience: 'Mais experientes',
  name_asc: 'Nome A→Z',
  name_desc: 'Nome Z→A',
};

/** Raios disponíveis (km) para o seletor de proximidade. */
const RADIUS_CHIPS: { km: number; label: string }[] = [
  { km: 5, label: '5 km' },
  { km: 10, label: '10 km' },
  { km: 25, label: '25 km' },
  { km: 50, label: '50 km' },
  { km: 100, label: '100 km' },
];

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const query = searchParams.get('q') || '';
  const cityParam = searchParams.get('cidade') || '';
  const cepParam = searchParams.get('cep') || '';
  const { city: geoCity, state: geoState, latitude: userLat, longitude: userLon, radiusKm, setRadius, requestPreciseLocation, geoFailed, source: geoSource, lastKnownAt, dismissGeoFailure } = useGeoCity();
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('categoria') || '');
  const [selectedCity, setSelectedCity] = useState(cityParam);
  const [selectedState, setSelectedState] = useState(searchParams.get('uf') || '');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(searchParams.get('bairro') || '');
  const [businessNameFilter, setBusinessNameFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [featuredFilter, setFeaturedFilter] = useState('all');
  const [minRating, setMinRating] = useState(0);
  // Default sort vem de `site_settings.default_search_sort` (admin-configurável).
  // Fallback: 'best' quando há GPS preciso, senão 'relevance'.
  // O usuário pode sobrescrever via ?ordem=... ou pelos chips.
  const defaultSearchSortSetting = useSettingValue('default_search_sort');
  const VALID_SORTS: SortOption[] = ['relevance','best','nearest','rating','reviews','name_asc','name_desc','experience'];
  const adminDefaultSort: SortOption | null = (VALID_SORTS as string[]).includes(defaultSearchSortSetting)
    ? (defaultSearchSortSetting as SortOption)
    : null;
  const initialSort = (searchParams.get('ordem') as SortOption)
    || adminDefaultSort
    || (userLat && userLon ? 'best' : 'relevance');
  const [sortBy, setSortBy] = useState<SortOption>(initialSort);
  const [showFilters, setShowFilters] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [acceptingOnly, setAcceptingOnly] = useState(false);
  const [activeTodayOnly, setActiveTodayOnly] = useState(false);
  const initialAvailability = (() => {
    const v = (searchParams.get('disponivel') || 'any').toLowerCase();
    return (['any', 'today', 'this_week', 'recent'] as const).includes(v as any)
      ? (v as 'any' | 'today' | 'this_week' | 'recent')
      : 'any';
  })();
  const [availabilityWindow, setAvailabilityWindow] = useState<'any' | 'today' | 'this_week' | 'recent'>(initialAvailability);

  const [showOutOfState, setShowOutOfState] = useState(false);
  const initialPage = (() => {
    const raw = parseInt(searchParams.get('page') || '1', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  })();
  const [page, setPage] = useState(initialPage);

  // Persiste `page`, `ordem` e `disponivel` na URL para que filtros e ordenação
  // possam ser compartilhados, voltados via histórico e indexados quando aplicável.
  // Mantém demais params; remove chave quando estiver no valor default.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (page > 1) next.set('page', String(page));
    else next.delete('page');
    if (availabilityWindow !== 'any') next.set('disponivel', availabilityWindow);
    else next.delete('disponivel');
    if (sortBy && sortBy !== 'relevance') next.set('ordem', sortBy);
    else next.delete('ordem');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, availabilityWindow, sortBy]);

  // Hidrata cidade/UF/bairro a partir de ?cep= (BrasilAPI → ViaCEP).
  // Roda apenas quando o CEP da URL muda; é idempotente (não sobrescreve cidade
  // já preenchida pelo usuário no mesmo CEP).
  const [resolvedCepNorm, setResolvedCepNorm] = useState<string | null>(null);
  useEffect(() => {
    const norm = normalizeCep(cepParam);
    if (!norm || norm === resolvedCepNorm) return;
    let cancelled = false;
    (async () => {
      const r = await lookupCep(cepParam);
      if (cancelled || !r.ok) return;
      setResolvedCepNorm(norm);
      setSelectedState(prev => prev || r.state);
      setSelectedCity(prev => prev || r.city);
      if (r.neighborhood) setSelectedNeighborhood(prev => prev || r.neighborhood!);
      setPage(1);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cepParam]);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [routeCorridor, setRouteCorridor] = useState<RouteCorridor | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');
  // Pesos do score híbrido (sortBy='best'). Admin define em site_settings com a
  // chave `search_score_weights` como JSON `{"rating":0.7,"distance":0.3}`.
  const scoreWeightsRaw = useSettingValue('search_score_weights');
  const scoreWeights = useMemo<SearchScoreWeights>(() => {
    if (!scoreWeightsRaw) return DEFAULT_SCORE_WEIGHTS;
    try {
      const parsed = JSON.parse(scoreWeightsRaw);
      const r = Number(parsed?.rating);
      const d = Number(parsed?.distance);
      if (Number.isFinite(r) && Number.isFinite(d) && r >= 0 && d >= 0 && r + d > 0) {
        return { rating: r, distance: d };
      }
    } catch {
      /* fallback */
    }
    return DEFAULT_SCORE_WEIGHTS;
  }, [scoreWeightsRaw]);
  const { enabled: urgencyMode, setEnabled: setUrgencyMode } = useUrgencyMode();
  const onlineSet = useOnlineProviders();
  const activeTodaySet = useActiveTodayProviders();
  const recentlyOfflineSet = useRecentlyOfflineSet();
  const realtimeHealth = useRealtimeHealth();
  const [presenceStatusFilter, setPresenceStatusFilter] = useState<'all' | 'online_first' | 'online_only' | 'recently_offline'>('all');

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
    isFetching,
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

  // FASE 2.1 — Public funnel telemetry (movido para depois de totalDisplay; ver effect abaixo).

  const localProviders = grouped?.local || [];
  const nearbyProviders = grouped?.nearby || [];
  const outOfStateProviders = grouped?.outOfState || [];
  const isFallback = grouped?.isFallback || false;

  // Combine for client-side filters
  const allProviders = useMemo(() => [...localProviders, ...nearbyProviders, ...outOfStateProviders], [localProviders, nearbyProviders, outOfStateProviders]);

  // Apply additional client-side filters
  const effectiveStatusFilter = realtimeHealth === 'degraded' ? 'all' : presenceStatusFilter;

  const applyClientFilters = useCallback((list: DbProvider[]) => {
    return applySearchFilters(list, {
      selectedNeighborhood,
      businessNameFilter,
      phoneFilter,
      featuredFilter: featuredFilter as 'all' | 'featured' | 'normal',
      onlineOnly,
      acceptingOnly,
      activeTodayOnly,
      sortBy,
      urgencyMode,
      onlineSet,
      activeTodaySet,
      recentlyOfflineSet,
      statusFilter: effectiveStatusFilter,
      availabilityWindow,
      scoreWeights,
      routeCorridor: routeCorridor
        ? {
            midLat: routeCorridor.midLat,
            midLon: routeCorridor.midLon,
            isInside: (lat, lon) => isInsideCorridor(lat, lon, routeCorridor),
          }
        : null,
    }) as DbProvider[];
  }, [selectedNeighborhood, businessNameFilter, phoneFilter, featuredFilter, sortBy, routeCorridor, urgencyMode, onlineSet, activeTodaySet, recentlyOfflineSet, effectiveStatusFilter, onlineOnly, acceptingOnly, activeTodayOnly, availabilityWindow, scoreWeights]);

  const stateFilterFn = useCallback((list: DbProvider[]) =>
    selectedState ? list.filter(p => safeUF(p.state) === selectedState) : list,
  [selectedState]);

  const filteredLocalRaw = useMemo(() => stateFilterFn(applyClientFilters(localProviders)), [applyClientFilters, localProviders, stateFilterFn]);
  const filteredNearby = useMemo(() => stateFilterFn(applyClientFilters(nearbyProviders)), [applyClientFilters, nearbyProviders, stateFilterFn]);
  const filteredOutOfState = useMemo(() => stateFilterFn(applyClientFilters(outOfStateProviders)), [applyClientFilters, outOfStateProviders, stateFilterFn]);

  // FASE 2.6 — Conversion boost leve + diversidade.
  // Aplica apenas quando `conversion_boost_enabled=true` em site_settings e
  // a ordenação é 'relevance'/'best' (não sobrepõe escolhas explícitas do usuário).
  const conversionBoostEnabled = useFeatureEnabled('conversion_boost_enabled');
  const reorderableSort = sortBy === 'relevance' || sortBy === 'best';
  const conversionIds = useMemo(
    () => filteredLocalRaw.slice(0, 80).map((p) => p.id).filter(Boolean),
    [filteredLocalRaw],
  );
  const { data: conversionMap } = useProviderConversionScores(
    conversionBoostEnabled && reorderableSort ? conversionIds : [],
    30,
  );
  const filteredLocal = useMemo(() => {
    if (!conversionBoostEnabled || !reorderableSort || !conversionMap) {
      return applyDiversityCap(filteredLocalRaw, 2);
    }
    // Reorder leve: score base = posição reversa (1..N), multiplicado pelo bucket.
    const N = filteredLocalRaw.length;
    const scored = filteredLocalRaw.map((p, idx) => {
      const bucket = conversionMap[p.id]?.bucket || 'unknown';
      const mult = BUCKET_MULTIPLIER[bucket];
      // base preserva ordem original como ancora primária; mult só desempata vizinhos.
      const base = (N - idx);
      return { p, score: base * mult, idx };
    });
    scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
    return applyDiversityCap(scored.map((s) => s.p), 2);
  }, [filteredLocalRaw, conversionMap, conversionBoostEnabled, reorderableSort]);

  const fullyFiltered = [...filteredLocal, ...filteredNearby, ...filteredOutOfState];
  const nearestFiltered = filteredLocal.length > 0 ? filteredLocal[0] : (filteredNearby.length > 0 ? filteredNearby[0] : undefined);
  const nearestDistanceKm = nearestFiltered?.distanceKm;
  const nearestCity = nearestFiltered?.city;
  const totalDisplay = filteredLocal.length + filteredNearby.length + (showOutOfState ? filteredOutOfState.length : 0);

  // FASE 2.1 — Public funnel telemetry (busca + result_count para zero-result insights).
  // Dedup 10 min em sessionStorage por (term, category, city, path); RPC re-dedupa server-side.
  useEffect(() => {
    if (isLoading) return;
    if (!selectedCategory && !query) return;
    void import('@/lib/publicFunnelTelemetry').then(({ trackPublicSearch }) =>
      trackPublicSearch({
        term: query || null,
        category: selectedCategory || null,
        city: effectiveCity || null,
        resultCount: totalDisplay,
        source: 'search_page',
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, selectedCategory, query, effectiveCity, totalDisplay]);

  const activeFilterCount = countActiveFilters({
    selectedCategory,
    selectedNeighborhood,
    businessNameFilter,
    phoneFilter,
    featuredFilter: featuredFilter as 'all' | 'featured' | 'normal',
    minRating,
    onlineOnly,
    acceptingOnly,
    activeTodayOnly,
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
    setActiveTodayOnly(false);
    setSelectedState('');
    setPage(1);
    // FIX 3 (Onda 4): limpar TODOS os params da URL exceto `q` (termo de busca).
    const next = new URLSearchParams();
    const q = searchParams.get('q');
    if (q) next.set('q', q);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  /**
   * FIX 3 (Onda 4) — sincronização bidirecional filtros ↔ URL.
   * Reflete os filtros ativos na query string para suportar share, botão
   * Voltar do browser e indexação SEO. `replace` evita poluir histórico.
   */
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const sync = (key: string, value: string) => {
      if (value) next.set(key, value);
      else next.delete(key);
    };
    sync('categoria', selectedCategory);
    sync('cidade', selectedCity);
    sync('uf', selectedState);
    sync('bairro', selectedNeighborhood);
    sync('rating', minRating > 0 ? String(minRating) : '');
    const current = searchParams.toString();
    const target = next.toString();
    if (current !== target) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedCity, selectedState, selectedNeighborhood, minRating]);

  // Unique cities & neighborhoods from results for autocomplete
  const availableCities = useMemo(() => {
    const cities = [...new Set(allProviders.map(p => p.city).filter(Boolean))];
    return cities.sort();
  }, [allProviders]);

  const availableStates = useMemo(() => {
    const states = [...new Set(allProviders.map(p => safeUF(p.state)).filter(Boolean))];
    return states.sort();
  }, [allProviders]);

  const availableNeighborhoods = useMemo(() => {
    let source = allProviders;
    if (selectedState) source = source.filter(p => safeUF(p.state) === selectedState);
    if (effectiveCity) source = source.filter(p => p.city.toLowerCase() === effectiveCity.toLowerCase());
    const nbs = [...new Set(source.map(p => p.neighborhood).filter(Boolean))];
    return nbs.sort();
  }, [allProviders, effectiveCity, selectedState]);

  // SEO — dynamic title/description/canonical reflecting active filters
  const seoCity = effectiveCity || '';
  const seoCategory = useMemo(() => {
    if (!selectedCategory) return '';
    return categories.find(c => c.slug === selectedCategory)?.name || '';
  }, [selectedCategory, categories]);

  const seoFilterParts: string[] = [];
  if (onlineOnly) seoFilterParts.push('online agora');
  if (activeTodayOnly) seoFilterParts.push('ativos hoje');
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

  const seoDesc = `Encontre ${seoSubject}${seoCity ? ` em ${seoCity}` : ' no Brasil'}${seoFilterSuffix}. ${totalDisplay > 0 ? `${totalDisplay} ${totalDisplay === 1 ? 'profissional disponível' : 'profissionais disponíveis'}.` : ''} Veja avaliações e fale direto com o profissional.`.trim();

  // Canonical estável: NÃO inclui `page` nem `disponivel` (filtros voláteis/de UI).
  // Toda página paginada e qualquer recorte por disponibilidade aponta canonical
  // para a versão "raiz" da combinação (q+categoria+cidade|cep+ordem). Isso evita
  // duplicação de conteúdo no índice do Google.
  // Regra anti-duplicação: quando há ?cep= válido, o canonical usa CEP (mais
  // preciso) e omite ?cidade=, já que o CEP resolve cidade+UF deterministicamente.
  const cepNormForSeo = normalizeCep(cepParam);
  const canonicalUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (selectedCategory) params.set('categoria', selectedCategory);
    if (cepNormForSeo) {
      params.set('cep', formatCep(cepNormForSeo));
    } else if (seoCity) {
      params.set('cidade', seoCity);
    }
    if (sortBy && sortBy !== 'relevance') params.set('ordem', sortBy);
    const qs = params.toString();
    return `${SITE_BASE_URL}/buscar${qs ? `?${qs}` : ''}`;
  }, [query, selectedCategory, seoCity, sortBy, cepNormForSeo]);

  // rel=prev / rel=next para paginação. Os links incluem TODOS os params atuais
  // (inclusive `disponivel`) porque apontam para variantes navegáveis pelo bot.
  const totalPages = Math.max(1, Math.ceil(totalDisplay / ITEMS_PER_PAGE));
  const buildPagedUrl = useCallback((targetPage: number) => {
    const params = new URLSearchParams(searchParams);
    if (targetPage > 1) params.set('page', String(targetPage));
    else params.delete('page');
    const qs = params.toString();
    return `${SITE_BASE_URL}/buscar${qs ? `?${qs}` : ''}`;
  }, [searchParams]);
  const prevUrl = page > 1 ? buildPagedUrl(page - 1) : undefined;
  const nextUrl = page < totalPages ? buildPagedUrl(page + 1) : undefined;

  // Noindex quando:
  //  - não há recorte editorial (sem q, categoria, cidade nem cep) → SERP fina
  //  - é uma página paginada (page > 1) → Google segue o canonical da página 1
  //  - há filtro de disponibilidade ativo → recorte volátil, não indexável
  //  - ?cep= está presente mas inválido (não-normalizável) → não indexa lixo
  const cepInUrlButInvalid = !!cepParam && !cepNormForSeo;
  const noindex =
    (!query && !selectedCategory && !seoCity && !cepNormForSeo) ||
    page > 1 ||
    availabilityWindow !== 'any' ||
    cepInUrlButInvalid;

  useSeoHead({ title: seoTitle, description: seoDesc, canonical: canonicalUrl, noindex, prevUrl, nextUrl });

  // PERF/UX FIX 7: paginação respeita totalDisplay (local + nearby + outOfState).
  // Distribui sequencialmente entre os grupos para não renderizar nearby/outOfState
  // completos em toda página (o que estourava DOM em buscas grandes).
  const localPageCount = Math.ceil(filteredLocal.length / ITEMS_PER_PAGE);
  const nearbyPageCount = Math.ceil(filteredNearby.length / ITEMS_PER_PAGE);
  const outOfStatePool = showOutOfState ? filteredOutOfState : [];
  let paginatedLocal: typeof filteredLocal = [];
  let paginatedNearby: typeof filteredNearby = [];
  let paginatedOutOfState: typeof filteredOutOfState = [];
  if (page <= localPageCount) {
    const offset = (page - 1) * ITEMS_PER_PAGE;
    paginatedLocal = filteredLocal.slice(offset, offset + ITEMS_PER_PAGE);
  } else if (page <= localPageCount + nearbyPageCount) {
    const nearbyPage = page - localPageCount - 1;
    const offset = nearbyPage * ITEMS_PER_PAGE;
    paginatedNearby = filteredNearby.slice(offset, offset + ITEMS_PER_PAGE);
  } else {
    const outPage = page - localPageCount - nearbyPageCount - 1;
    const offset = outPage * ITEMS_PER_PAGE;
    paginatedOutOfState = outOfStatePool.slice(offset, offset + ITEMS_PER_PAGE);
  }

  // JSON-LD ItemList — reflete APENAS os itens visíveis na página atual.
  // Inclui propriedades adicionais (aggregateRating + offers.availability)
  // quando aplicável, ajudando o Google a entender riqueza/disponibilidade.
  const jsonLdData = useMemo(() => {
    const visible = [...paginatedLocal, ...paginatedNearby, ...paginatedOutOfState].slice(0, 20);
    if (!visible.length) return null;
    const startPos = (page - 1) * ITEMS_PER_PAGE;
    const items = visible.map((p, i) => {
      const url = `${SITE_BASE_URL}/profissional/${p.slug}`;
      const name = p.businessName || p.name;
      const item: Record<string, unknown> = {
        '@type': 'LocalBusiness',
        '@id': url,
        url,
        name,
      };
      if (p.city) item.address = { '@type': 'PostalAddress', addressLocality: p.city, addressRegion: safeUF(p.state) || undefined, addressCountry: 'BR' };
      if (typeof p.rating === 'number' && p.rating > 0 && (p.reviewCount ?? 0) > 0) {
        item.aggregateRating = {
          '@type': 'AggregateRating',
          ratingValue: Number(p.rating.toFixed(2)),
          reviewCount: p.reviewCount,
          bestRating: 5,
          worstRating: 1,
        };
      }
      // Disponibilidade: usa presença online/ativo hoje quando conhecido.
      const isOnline = onlineSet.has(p.userId);
      const isActiveToday = activeTodaySet.has(p.userId);
      if (isOnline || isActiveToday) {
        item.offers = {
          '@type': 'Offer',
          availability: isOnline ? 'https://schema.org/InStock' : 'https://schema.org/LimitedAvailability',
          url,
        };
      }
      return {
        '@type': 'ListItem',
        position: startPos + i + 1,
        item,
      };
    });
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: seoTitle,
      description: seoDesc,
      numberOfItems: items.length,
      itemListOrder: sortBy === 'rating' ? 'https://schema.org/ItemListOrderDescending' : 'https://schema.org/ItemListUnordered',
      itemListElement: items,
    };
  }, [paginatedLocal, paginatedNearby, paginatedOutOfState, page, seoTitle, seoDesc, sortBy, onlineSet, activeTodaySet]);

  useJsonLd(jsonLdData);

  // Sub-agrupamento por bairro dentro do bloco "local" — só aplica
  // quando há GPS, ordenação 'nearest' e diversidade de bairros (>=2).
  const localGroupedByNeighborhood = useMemo(() => {
    if (!userLat || !userLon || sortBy !== 'nearest') return null;
    const groups = new Map<string, DbProvider[]>();
    for (const p of paginatedLocal) {
      const key = (p.neighborhood || '').trim() || 'Outros';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    if (groups.size < 2) return null;
    // Ordena bairros pela menor distância do primeiro card (já vem ordenado por distância).
    return Array.from(groups.entries()).sort((a, b) => {
      const da = a[1][0]?.distanceKm ?? Number.MAX_VALUE;
      const db = b[1][0]?.distanceKm ?? Number.MAX_VALUE;
      return da - db;
    });
  }, [paginatedLocal, userLat, userLon, sortBy]);

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
      {/* CEP lookup com fallback para cidade */}
      <CepLookupField
        helper="Informe seu CEP — preenchemos cidade e estado automaticamente."
        onFallbackCity={() => {
          // Foco no select de cidade abaixo
          toast.info('Selecione manualmente sua cidade abaixo.');
        }}
        onResolved={(r) => {
          setSelectedState(r.state);
          setSelectedCity(r.city);
          if (r.neighborhood) setSelectedNeighborhood(r.neighborhood);
          setPage(1);
          toast.success(`Filtro aplicado: ${r.city} • ${r.state}`);
        }}
      />

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

      {/* UF / Estado */}
      {availableStates.length > 1 && (
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Estado (UF)
          </Label>
          <Select value={selectedState || 'all'} onValueChange={v => { setSelectedState(v === 'all' ? '' : v); setSelectedCity(''); setSelectedNeighborhood(''); setPage(1); }}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {availableStates.map((uf: string) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
            <SelectItem value="featured">
              <span className="inline-flex items-center gap-1.5"><Star className="h-3 w-3 fill-current" strokeWidth={1.75} /> Destaques</span>
            </SelectItem>
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
              <Circle className={`h-2 w-2 ${onlineOnly ? 'fill-emerald-500 text-emerald-500' : 'fill-muted-foreground/40 text-muted-foreground/70'}`} />
              Online agora
            </span>
            <span className="text-[10px] font-semibold">{onlineOnly ? 'ATIVO' : 'OFF'}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTodayOnly(v => !v); setPage(1); }}
            className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
              activeTodayOnly
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                : 'border-border bg-background text-muted-foreground hover:bg-muted'
            }`}
            aria-pressed={activeTodayOnly}
          >
            <span className="inline-flex items-center gap-1.5">
              <Circle className={`h-2 w-2 ${activeTodayOnly ? 'fill-amber-500 text-amber-500' : 'fill-muted-foreground/40 text-muted-foreground/70'}`} />
              Ativo hoje
            </span>
            <span className="text-[10px] font-semibold">{activeTodayOnly ? 'ATIVO' : 'OFF'}</span>
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

        {/* Janela de disponibilidade (período) — persistida em ?disponivel= */}
        <div className="mt-2">
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Disponibilidade
          </label>
          <div className="flex flex-wrap gap-1.5">
            {([
              { v: 'any', label: 'Qualquer' },
              { v: 'today', label: 'Hoje' },
              { v: 'this_week', label: 'Esta semana' },
              { v: 'recent', label: 'Recente' },
            ] as const).map((opt) => {
              const active = availabilityWindow === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => { setAvailabilityWindow(opt.v); setPage(1); }}
                  aria-pressed={active}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    active
                      ? 'border-primary/50 bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status (presença em tempo real) */}
      <div>
        <Label className="text-xs text-muted-foreground flex items-center justify-between">
          <span>Status</span>
          {realtimeHealth === 'connecting' && (
            <span className="text-[10px] font-medium text-muted-foreground/70">conectando…</span>
          )}
          {realtimeHealth === 'degraded' && (
            <span className="text-[10px] font-medium text-muted-foreground/70">tempo real indisponível</span>
          )}
        </Label>
        {realtimeHealth === 'connecting' ? (
          <div
            className="mt-1 h-9 rounded-md bg-muted/40 ring-1 ring-border/40 animate-pulse"
            aria-hidden="true"
          />
        ) : (
          <Select
            value={presenceStatusFilter}
            onValueChange={(v) => { setPresenceStatusFilter(v as typeof presenceStatusFilter); setPage(1); }}
            disabled={realtimeHealth === 'degraded'}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="online_first">
                <span className="inline-flex items-center gap-1.5">
                  <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" /> Online primeiro
                </span>
              </SelectItem>
              <SelectItem value="online_only">
                <span className="inline-flex items-center gap-1.5">
                  <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" /> Apenas Online
                </span>
              </SelectItem>
              <SelectItem value="recently_offline">
                <span className="inline-flex items-center gap-1.5">
                  <Circle className="h-2 w-2 fill-muted-foreground/50 text-muted-foreground/70" /> Recentemente Offline
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        )}
        <a
          href="/ajuda/online-offline"
          className="mt-1.5 inline-block text-[10px] text-muted-foreground/70 hover:text-foreground underline-offset-2 hover:underline"
        >
          Como funciona Online/Offline?
        </a>
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
              <SelectItem value="best">
                <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3 w-3" strokeWidth={1.75} /> Melhor combinação</span>
              </SelectItem>
              <SelectItem value="nearest">
                <span className="inline-flex items-center gap-1.5"><Compass className="h-3 w-3" strokeWidth={1.75} /> Mais perto</span>
              </SelectItem>
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

          {/* CTA topo — buscar perto da cidade detectada */}
          {(geoCity || effectiveCity) && !cityParam && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 flex justify-center sm:justify-start"
            >
              <Button
                size="sm"
                variant="default"
                className="rounded-full px-4 text-xs font-semibold shadow-xs"
                onClick={() => {
                  const target = (geoCity || effectiveCity).trim();
                  if (!target) return;
                  setSelectedCity(target);
                  setPage(1);
                  const next = new URLSearchParams(searchParams);
                  next.set('cidade', target);
                  setSearchParams(next, { replace: true });
                }}
              >
                <MapPin className="mr-1.5 h-3.5 w-3.5" />
                Buscar perto de {geoCity || effectiveCity}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </motion.div>
          )}

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
              {SORT_CHIPS.map(chip => {
                const ChipIcon = chip.icon;
                const isActive = sortBy === chip.value;
                return (
                  <button
                    key={chip.value}
                    onClick={() => { setSortBy(chip.value); setPage(1); }}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <ChipIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {chip.label}
                  </button>
                );
              })}
            </div>
            {/* Radius chips — só fazem sentido com GPS */}
            {userLat != null && userLon != null && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <Compass className="h-3 w-3" strokeWidth={1.75} />
                  Raio:
                </span>
                {RADIUS_CHIPS.map(r => {
                  const isActive = radiusKm === r.km;
                  return (
                    <button
                      key={r.km}
                      onClick={() => { setRadius(r.km); setPage(1); }}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      aria-pressed={isActive}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            )}
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
                {isLoading ? (
                  'Buscando...'
                ) : (() => {
                  const localCount = filteredLocal.length;
                  const nearbyCount = filteredNearby.length;
                  const outCount = showOutOfState ? filteredOutOfState.length : 0;
                  const fmt = (n: number) => `${n} profissional${n === 1 ? '' : 'is'}`;

                  // Sem cidade definida → contagem geral
                  if (!effectiveCity) {
                    return (
                      <>
                        {`${totalDisplay} profissional${totalDisplay === 1 ? '' : 'is'} encontrado${totalDisplay === 1 ? '' : 's'}`}
                        {query && <> para "<span className="font-semibold text-foreground">{query}</span>"</>}
                      </>
                    );
                  }

                  // Fallback: 0 na cidade, mostra só vizinhança
                  if (isFallback) {
                    return (
                      <>
                        <span className="font-semibold text-foreground">0</span> em{' '}
                        <span className="font-semibold text-foreground">{effectiveCity}</span>
                        {nearbyCount + outCount > 0 && (
                          <> · <span className="font-semibold text-foreground">{nearbyCount + outCount}</span> em cidades próximas auditadas</>
                        )}
                      </>
                    );
                  }

                  // Caso normal: tem resultados na cidade. Mostra ambos quando houver vizinhos.
                  return (
                    <>
                      <span className="font-semibold text-foreground">{fmt(localCount)}</span>{' '}
                      em <span className="font-semibold text-foreground">{effectiveCity}</span>
                      {nearbyCount > 0 && (
                        <> · <span className="font-semibold text-foreground">{nearbyCount}</span> em cidades próximas auditadas</>
                      )}
                      {outCount > 0 && (
                        <> · <span className="font-semibold text-foreground">{outCount}</span> em outros estados</>
                      )}
                      {query && <> para "<span className="font-semibold text-foreground">{query}</span>"</>}
                    </>
                  );
                })()}
              </p>
              <div className="flex items-center gap-2">
                {!isFallback && filteredLocal.length > 0 && effectiveCity && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-medium text-primary">
                    <MapPin className="h-3 w-3" />
                    {filteredLocal.length} na sua região
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-medium text-muted-foreground"
                  title={
                    sortBy === 'best'
                      ? `Score: rating ${(scoreWeights.rating).toFixed(2)} + distância ${(scoreWeights.distance).toFixed(2)}`
                      : SORT_CRITERIA_HINT[sortBy]
                  }
                  aria-label={`Critério de ordenação: ${SORT_CRITERIA_HINT[sortBy]}`}
                >
                  <ArrowUpDown className="h-3 w-3" />
                  Ordenando por: <span className="font-semibold text-foreground">{SORT_CRITERIA_HINT[sortBy]}</span>
                </span>
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
                    <span className="inline-flex items-center gap-1">
                      {featuredFilter === 'featured' ? (<><Star className="h-3 w-3 fill-current" strokeWidth={1.75} /> Destaques</>) : 'Normais'}
                    </span>
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFeaturedFilter('all')} />
                  </Badge>
                )}
                {minRating > 0 && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <span className="inline-flex items-center gap-1">{minRating}+ <Star className="h-3 w-3 fill-current" strokeWidth={1.75} /></span>
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setMinRating(0)} />
                  </Badge>
                )}
                {onlineOnly && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" /> Online agora
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setOnlineOnly(false)} />
                  </Badge>
                )}
                {activeTodayOnly && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Circle className="h-2 w-2 fill-amber-500 text-amber-500" /> Ativo hoje
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setActiveTodayOnly(false)} />
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
                  onlineSet={onlineSet}
                  activeTodaySet={activeTodaySet}
                  className="mb-4"
                />
              </Suspense>
            )}

            {isFetching && !isLoading && (
              <ProgressIndicator label="Atualizando resultados da busca" className="mb-3" />
            )}

            {isLoading ? (
              <div data-testid="search-loading" className="motion-enter-fade">
                <ProgressIndicator label="Buscando profissionais" className="mb-3" />
                <PinnedSponsorSkeleton />
                <div className="motion-stagger grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  <ProviderCardSkeleton count={4} />
                </div>
              </div>
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
                    {localGroupedByNeighborhood ? (
                      // Sub-agrupado por bairro (GPS + sort=nearest + >=2 bairros)
                      <div className="space-y-5">
                        {localGroupedByNeighborhood.map(([bairro, items]) => (
                          <div key={bairro}>
                            <div className="mb-2 flex items-center gap-2">
                              <Building2 className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {bairro}
                              </span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{items.length}</Badge>
                              {items[0]?.distanceKm != null && items[0].distanceKm > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  ~{items[0].distanceKm.toFixed(1)} km
                                </span>
                              )}
                              <div className="h-px flex-1 bg-border" />
                            </div>
                            <motion.div
                              className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2"
                              initial="hidden"
                              animate="show"
                              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                            >
                              {items.map((p, idx) => (
                                <motion.div
                                  key={p.id}
                                  variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                                  transition={{ duration: 0.3 }}
                                  layout
                                  className="relative"
                                >
                                  {sortBy === 'best' && (
                                    <ScoreTooltipBadge
                                      rating={p.rating}
                                      reviewCount={p.reviewCount}
                                      distanceKm={p.distanceKm}
                                      weights={scoreWeights}
                                    />
                                  )}
                                  <ProviderRenderer provider={p} isFallback={isFallback} index={idx} />
                                </motion.div>
                              ))}
                            </motion.div>
                          </div>
                        ))}
                      </div>
                    ) : (
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
                              className="relative"
                            >
                              {sortBy === 'best' && (
                                <ScoreTooltipBadge
                                  rating={p.rating}
                                  reviewCount={p.reviewCount}
                                  distanceKm={p.distanceKm}
                                  weights={scoreWeights}
                                />
                              )}
                              <ProviderRenderer provider={p} isFallback={isFallback} index={idx} />
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
                    )}
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
                          <ProviderRenderer provider={p} isFallback={isFallback} />
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
                      className="group relative inline-flex items-center gap-2 sm:gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 px-4 py-3 sm:px-6 sm:py-4 text-sm font-semibold text-foreground shadow-xs transition-all hover:shadow-md hover:border-primary/40 hover:scale-[1.02] active:scale-[0.98]"
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
                          <ProviderRenderer provider={p} isFallback={true} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </>
                )}

                {totalDisplay === 0 && (
                  searchError ? (
                    /* FIX 1B (Onda 4) — Variante de erro de rede */
                    <SearchEmptyState variant="error" onRetry={() => refetch()} />
                  ) : activeFilterCount > 0 ? (
                    /* Filtros ativos sem resultado — manter CTA "limpar filtros" */
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Search className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h3 className="font-display text-base font-semibold text-foreground">
                        Nenhum profissional encontrado{effectiveCity ? ` em ${effectiveCity}` : ''}
                      </h3>
                      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                        Tente remover alguns filtros ou ampliar a busca para a região vizinha.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Button size="sm" variant="outline" onClick={clearAllFilters} className="rounded-full">
                          <X className="mr-1.5 h-3.5 w-3.5" /> Limpar filtros
                        </Button>
                        {effectiveCity && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => {
                              setSelectedCity('');
                              setSelectedNeighborhood('');
                              setPage(1);
                            }}
                          >
                            <MapPin className="mr-1.5 h-3.5 w-3.5" /> Buscar na região vizinha
                          </Button>
                        )}
                        {selectedCategory && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => {
                              setSelectedCategory('');
                              setPage(1);
                            }}
                          >
                            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Ver todas as categorias
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* FIX 1A (Onda 4) — Funil "Seja o Mestre" */
                    <SearchEmptyState
                      variant="results"
                      city={effectiveCity || undefined}
                      categorySlug={selectedCategory || undefined}
                      categoryName={seoCategory || undefined}
                      query={query || undefined}
                    />
                  )
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
