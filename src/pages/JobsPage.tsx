import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Briefcase, Search, MessageCircle, Filter, Building2, X, Sparkles, ArrowRight, ChevronLeft, ChevronRight, SlidersHorizontal, Clock, ListOrdered, CalendarDays, Tag } from 'lucide-react';
import GeoFallbackBanner from '@/components/GeoFallbackBanner';
import GeoLocationChip from '@/components/GeoLocationChip';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useGeoCity } from '@/hooks/useGeoCity';
import AdNativeCard from '@/components/ads/AdNativeCard';
import { lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FadeInSection from '@/components/FadeInSection';

const AdSlot = lazy(() => importWithRetry(() => import('@/components/ads/AdSlot')));

const JOB_TYPES = [
  { value: '', label: 'Todos os tipos' },
  { value: 'clt', label: 'CLT' },
  { value: 'pj', label: 'PJ / Autônomo' },
  { value: 'estagio', label: 'Estágio' },
  { value: 'temporario', label: 'Temporário' },
  { value: 'aprendiz', label: 'Aprendiz' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'meio-periodo', label: 'Meio período' },
];

const WORK_MODELS = [
  { value: '', label: 'Todos os modelos' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'remoto', label: 'Remoto' },
  { value: 'hibrido', label: 'Híbrido' },
];

const OPPORTUNITY_TYPES = [
  { value: '', label: 'Todas' },
  { value: 'emprego', label: 'Emprego' },
  { value: 'servico', label: 'Serviço' },
  { value: 'freelance', label: 'Freelance' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigas' },
  { value: 'title', label: 'Título A-Z' },
];

const PER_PAGE_OPTIONS = [10, 20, 30, 50];
const NATIVE_AD_INTERVAL = 8;

function timeAgo(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'ontem';
  if (days < 7) return `${days} dias atrás`;
  if (days < 30) return `${Math.floor(days / 7)} sem atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const JobsPage = () => {
  const { city: geoCity } = useGeoCity();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [cityFilter, setCityFilter] = useState(searchParams.get('city') || '');
  const [jobTypeFilter, setJobTypeFilter] = useState(searchParams.get('type') || '');
  const [workModelFilter, setWorkModelFilter] = useState(searchParams.get('model') || '');
  const [opportunityFilter, setOpportunityFilter] = useState(searchParams.get('opp') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'recent');
  const [perPage, setPerPage] = useState(Number(searchParams.get('pp')) || 20);
  const [page, setPage] = useState(Number(searchParams.get('p')) || 1);
  const [showFilters, setShowFilters] = useState(false);
  const [geoApplied, setGeoApplied] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('cat') || '');

  // Sync URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.q = search;
    if (cityFilter) params.city = cityFilter;
    if (jobTypeFilter) params.type = jobTypeFilter;
    if (workModelFilter) params.model = workModelFilter;
    if (opportunityFilter) params.opp = opportunityFilter;
    if (categoryFilter) params.cat = categoryFilter;
    if (sortBy !== 'recent') params.sort = sortBy;
    if (perPage !== 20) params.pp = String(perPage);
    if (page > 1) params.p = String(page);
    setSearchParams(params, { replace: true });
  }, [search, cityFilter, jobTypeFilter, workModelFilter, opportunityFilter, sortBy, perPage, page, categoryFilter]);

  useEffect(() => {
    if (geoCity && !geoApplied && !cityFilter) {
      setCityFilter(geoCity);
      setGeoApplied(true);
    }
  }, [geoCity, geoApplied, cityFilter]);

  // Reset page on filter change
  const resetPage = useCallback(() => setPage(1), []);
  const updateFilter = useCallback((setter: (v: string) => void) => (v: string) => {
    setter(v);
    resetPage();
  }, [resetPage]);

  const seoCity = cityFilter || geoCity || '';
  useSeoHead({
    title: seoCity ? `Vagas em ${seoCity} | Preciso de um` : 'Portal de Vagas | Preciso de um',
    description: seoCity
      ? `Encontre vagas de trabalho e oportunidades de serviço em ${seoCity}.`
      : 'Portal de vagas: encontre oportunidades de trabalho, serviço e freelance na sua cidade.',
    canonical: `${SITE_BASE_URL}/vagas`,
  });

  const activeFiltersCount = [jobTypeFilter, workModelFilter, opportunityFilter, categoryFilter].filter(Boolean).length;

  // Paginated query with count
  const { data: queryResult, isLoading } = useQuery({
    queryKey: ['jobs-paginated', search, cityFilter, jobTypeFilter, workModelFilter, opportunityFilter, categoryFilter, sortBy, perPage, page],
    queryFn: async () => {
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      let query = supabase
        .from('jobs')
        .select('*, categories(name, slug, icon)', { count: 'exact' })
        .eq('status', 'active')
        .is('deleted_at', null);

      // Filters
      if (search) query = query.ilike('title', `%${search}%`);
      if (cityFilter) query = query.ilike('city', `%${cityFilter}%`);
      if (jobTypeFilter) query = query.eq('job_type', jobTypeFilter);
      if (workModelFilter) query = query.eq('work_model', workModelFilter);
      if (opportunityFilter) query = query.eq('opportunity_type', opportunityFilter);
      if (categoryFilter) query = query.eq('category_id', categoryFilter);

      // Sort
      if (sortBy === 'oldest') {
        query = query.order('created_at', { ascending: true });
      } else if (sortBy === 'title') {
        query = query.order('title', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, count } = await query.range(from, to);
      return { jobs: data || [], total: count || 0 };
    },
  });

  const jobs = queryResult?.jobs || [];
  const totalCount = queryResult?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  // Fallback: fetch without city if no results
  const { data: jobsNoCityResult } = useQuery({
    queryKey: ['jobs-noCity-paginated', search, jobTypeFilter, workModelFilter, opportunityFilter, categoryFilter, sortBy],
    queryFn: async () => {
      let query = supabase
        .from('jobs')
        .select('*, categories(name, slug, icon)', { count: 'exact' })
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (search) query = query.ilike('title', `%${search}%`);
      if (jobTypeFilter) query = query.eq('job_type', jobTypeFilter);
      if (workModelFilter) query = query.eq('work_model', workModelFilter);
      if (opportunityFilter) query = query.eq('opportunity_type', opportunityFilter);
      if (categoryFilter) query = query.eq('category_id', categoryFilter);
      const { data, count } = await query.limit(perPage);
      return { jobs: data || [], total: count || 0 };
    },
    enabled: !!cityFilter && jobs.length === 0 && !isLoading,
    staleTime: 1000 * 60 * 5,
  });

  const jobsFallback = jobs.length === 0 && cityFilter && (jobsNoCityResult?.jobs?.length || 0) > 0;
  const displayJobs = jobsFallback ? jobsNoCityResult!.jobs : jobs;
  const displayTotal = jobsFallback ? jobsNoCityResult!.total : totalCount;

  // Categories for sidebar
  const { data: categories = [] } = useQuery({
    queryKey: ['jobs-categories-sidebar'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name, icon, slug').is('deleted_at', null).order('name');
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Cities list
  const { data: cities = [] } = useQuery({
    queryKey: ['jobs-cities'],
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('name').order('name').limit(80);
      return (data || []).map((c: any) => c.name);
    },
  });

  // Stats per opportunity type
  const { data: oppStats } = useQuery({
    queryKey: ['jobs-opp-stats'],
    queryFn: async () => {
      const base = supabase.from('jobs').select('opportunity_type').eq('status', 'active').is('deleted_at', null);
      const { data } = await base;
      const counts: Record<string, number> = { emprego: 0, servico: 0, freelance: 0 };
      (data || []).forEach((j: any) => { if (counts[j.opportunity_type] !== undefined) counts[j.opportunity_type]++; });
      return counts;
    },
    staleTime: 1000 * 60 * 10,
  });

  const jobTypeLabel = (v: string) => JOB_TYPES.find(t => t.value === v)?.label || v;
  const workModelLabel = (v: string) => WORK_MODELS.find(t => t.value === v)?.label || v;

  const clearAllFilters = () => {
    setSearch(''); setCityFilter(''); setJobTypeFilter('');
    setWorkModelFilter(''); setOpportunityFilter(''); setCategoryFilter('');
    setPage(1);
  };

  // Build items with native ads
  let nativeAdCount = 0;
  const itemsWithAds: Array<{ type: 'job'; data: any } | { type: 'ad'; index: number }> = [];
  displayJobs.forEach((job: any, i: number) => {
    itemsWithAds.push({ type: 'job', data: job });
    if ((i + 1) % NATIVE_AD_INTERVAL === 0) {
      itemsWithAds.push({ type: 'ad', index: nativeAdCount++ });
    }
  });

  // Pagination range
  const paginationRange = useMemo(() => {
    const range: number[] = [];
    const delta = 2;
    const left = Math.max(2, page - delta);
    const right = Math.min(totalPages - 1, page + delta);
    range.push(1);
    if (left > 2) range.push(-1); // ellipsis
    for (let i = left; i <= right; i++) range.push(i);
    if (right < totalPages - 1) range.push(-2); // ellipsis
    if (totalPages > 1) range.push(totalPages);
    return range;
  }, [page, totalPages]);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Header />

      {/* ── Hero Section ── */}
      <section className="relative overflow-x-clip bg-gradient-to-br from-primary via-primary/90 to-accent/80 py-8 sm:py-12">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
        <div className="container relative z-10 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mx-auto max-w-3xl text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Portal de Vagas & Oportunidades
            </div>
            <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
              Encontre a vaga ideal{seoCity ? <> em <span className="text-accent">{seoCity}</span></> : ''}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">
              Conecte-se com oportunidades reais de trabalho, serviço e freelance
            </p>

            {/* Search bar */}
            <div className="mx-auto mt-5 max-w-2xl">
              <div className="flex overflow-hidden rounded-xl bg-white shadow-lg">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Cargo, empresa ou palavra-chave..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                    className="h-12 w-full bg-transparent pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none sm:h-13"
                  />
                </div>
                <div className="hidden items-center border-l border-border px-1 sm:flex">
                  <select
                    value={cityFilter}
                    onChange={(e) => { setCityFilter(e.target.value); resetPage(); }}
                    className="h-full appearance-none bg-transparent px-3 text-sm text-foreground focus:outline-none"
                  >
                    <option value="">Todas as cidades</option>
                    {cities.map((c: string) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <Button variant="accent" className="m-1.5 rounded-lg px-6 font-semibold">
                  Buscar
                </Button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {oppStats && (
                <>
                  <button onClick={() => { setOpportunityFilter(opportunityFilter === 'emprego' ? '' : 'emprego'); resetPage(); }} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${opportunityFilter === 'emprego' ? 'bg-white text-primary' : 'bg-white/15 text-white/90 hover:bg-white/25'}`}>
                    <Briefcase className="h-3.5 w-3.5" /> {oppStats.emprego} Empregos
                  </button>
                  <button onClick={() => { setOpportunityFilter(opportunityFilter === 'servico' ? '' : 'servico'); resetPage(); }} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${opportunityFilter === 'servico' ? 'bg-white text-primary' : 'bg-white/15 text-white/90 hover:bg-white/25'}`}>
                    <Building2 className="h-3.5 w-3.5" /> {oppStats.servico} Serviços
                  </button>
                  <button onClick={() => { setOpportunityFilter(opportunityFilter === 'freelance' ? '' : 'freelance'); resetPage(); }} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${opportunityFilter === 'freelance' ? 'bg-white text-primary' : 'bg-white/15 text-white/90 hover:bg-white/25'}`}>
                    <Tag className="h-3.5 w-3.5" /> {oppStats.freelance} Freelance
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Toolbar ── */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Mobile city */}
            <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); resetPage(); }} className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground sm:hidden">
              <option value="">Todas as cidades</option>
              {cities.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>

            <GeoLocationChip />

            {/* Sort */}
            <div className="hidden items-center gap-1.5 sm:flex">
              <ListOrdered className="h-3.5 w-3.5 text-muted-foreground" />
              <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); resetPage(); }} className="appearance-none bg-transparent text-xs font-medium text-foreground focus:outline-none">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button variant={showFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1 text-xs h-8">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 min-w-[16px] rounded-full p-0 text-[9px]">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>

              {/* Per page */}
              <div className="hidden items-center gap-1 sm:flex">
                <span className="text-[10px] text-muted-foreground">Exibir:</span>
                <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); resetPage(); }} className="appearance-none rounded border border-input bg-background px-1.5 py-1 text-xs text-foreground focus:outline-none">
                  {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <Button variant="accent" size="sm" asChild className="gap-1 text-xs h-8">
                <Link to="/dashboard/vagas">
                  <Briefcase className="h-3.5 w-3.5" /> Publicar
                </Link>
              </Button>
            </div>
          </div>

          {/* Expanded filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2.5 rounded-lg border border-border bg-card p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Tipo de Contrato</label>
                      <select value={jobTypeFilter} onChange={(e) => updateFilter(setJobTypeFilter)(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground">
                        {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Modelo de Trabalho</label>
                      <select value={workModelFilter} onChange={(e) => updateFilter(setWorkModelFilter)(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground">
                        {WORK_MODELS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Categoria</label>
                      <select value={categoryFilter} onChange={(e) => updateFilter(setCategoryFilter)(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground">
                        <option value="">Todas</option>
                        {categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end">
                      {activeFiltersCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearAllFilters} className="w-full gap-1 text-xs h-8">
                          <X className="h-3 w-3" /> Limpar tudo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Ads top ── */}
      <Suspense fallback={null}><AdSlot slotSlug="jobs-top" city={cityFilter} /></Suspense>

      {/* ── Main content ── */}
      <div className="container px-4 py-5">
        <div className="flex gap-6">
          {/* Left sidebar: categories & stats */}
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-14 space-y-4">
              {/* Summary card */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Briefcase className="h-3.5 w-3.5 text-accent" /> Resumo
                </h3>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total de vagas</span>
                    <span className="font-semibold text-foreground">{displayTotal}</span>
                  </div>
                  {oppStats && Object.entries(oppStats).map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{key === 'servico' ? 'Serviço' : key === 'emprego' ? 'Emprego' : 'Freelance'}</span>
                      <span className="font-medium text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Tag className="h-3.5 w-3.5 text-accent" /> Categorias
                </h3>
                <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
                  <button
                    onClick={() => updateFilter(setCategoryFilter)('')}
                    className={`w-full rounded px-2 py-1.5 text-left text-xs transition-colors ${!categoryFilter ? 'bg-accent/10 font-medium text-accent' : 'text-muted-foreground hover:bg-muted/50'}`}
                  >
                    Todas as categorias
                  </button>
                  {categories.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => updateFilter(setCategoryFilter)(categoryFilter === c.id ? '' : c.id)}
                      className={`w-full rounded px-2 py-1.5 text-left text-xs transition-colors ${categoryFilter === c.id ? 'bg-accent/10 font-medium text-accent' : 'text-muted-foreground hover:bg-muted/50'}`}
                    >
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 border border-accent/20 p-4">
                <p className="text-xs font-bold text-foreground">Publique uma vaga</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Grátis e sem burocracia</p>
                <Button variant="accent" size="sm" asChild className="mt-3 w-full gap-1 text-xs">
                  <Link to="/dashboard/vagas"><Briefcase className="h-3 w-3" /> Publicar</Link>
                </Button>
              </div>
            </div>
          </aside>

          {/* Main list */}
          <div className="min-w-0 flex-1">
            {/* Results header */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {isLoading ? 'Buscando...' : (
                    <>
                      <span className="font-semibold text-foreground">{displayTotal}</span> vaga{displayTotal !== 1 ? 's' : ''}
                      {cityFilter && <> em <span className="font-medium text-foreground">{cityFilter}</span></>}
                    </>
                  )}
                </p>
                {/* Page indicator */}
                {totalPages > 1 && !isLoading && (
                  <span className="text-[10px] text-muted-foreground">
                    (Página {page} de {totalPages})
                  </span>
                )}
              </div>

              {/* Active filter tags */}
              {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cityFilter && (
                    <Badge variant="secondary" className="gap-1 pr-1 text-[10px]">
                      <MapPin className="h-2.5 w-2.5" /> {cityFilter}
                      <button onClick={() => { setCityFilter(''); resetPage(); }} className="ml-0.5 rounded-full p-0.5 hover:bg-muted"><X className="h-2.5 w-2.5" /></button>
                    </Badge>
                  )}
                  {jobTypeFilter && (
                    <Badge variant="secondary" className="gap-1 pr-1 text-[10px]">
                      {jobTypeLabel(jobTypeFilter)}
                      <button onClick={() => { setJobTypeFilter(''); resetPage(); }} className="ml-0.5 rounded-full p-0.5 hover:bg-muted"><X className="h-2.5 w-2.5" /></button>
                    </Badge>
                  )}
                  {workModelFilter && (
                    <Badge variant="secondary" className="gap-1 pr-1 text-[10px]">
                      {workModelLabel(workModelFilter)}
                      <button onClick={() => { setWorkModelFilter(''); resetPage(); }} className="ml-0.5 rounded-full p-0.5 hover:bg-muted"><X className="h-2.5 w-2.5" /></button>
                    </Badge>
                  )}
                  {categoryFilter && (
                    <Badge variant="secondary" className="gap-1 pr-1 text-[10px]">
                      {categories.find((c: any) => c.id === categoryFilter)?.name || 'Categoria'}
                      <button onClick={() => { setCategoryFilter(''); resetPage(); }} className="ml-0.5 rounded-full p-0.5 hover:bg-muted"><X className="h-2.5 w-2.5" /></button>
                    </Badge>
                  )}
                </div>
              )}

              {/* Mobile sort */}
              <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); resetPage(); }} className="appearance-none rounded border border-input bg-background px-2 py-1 text-[10px] text-foreground focus:outline-none sm:hidden">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
              </div>
            ) : displayJobs.length === 0 ? (
              <div className="mt-12 text-center sm:mt-16">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                  <Briefcase className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-semibold text-foreground">Nenhuma vaga encontrada</p>
                <p className="mt-1 text-sm text-muted-foreground">Tente alterar os filtros ou seja o primeiro a publicar!</p>
                <div className="mt-4 flex justify-center gap-3">
                  <Button variant="outline" onClick={clearAllFilters}>Limpar filtros</Button>
                  <Button variant="accent" asChild><Link to="/dashboard/vagas">Publicar Vaga</Link></Button>
                </div>
              </div>
            ) : (
              <>
                {jobsFallback && (
                  <GeoFallbackBanner
                    originalCity={cityFilter}
                    expansionLevel="all"
                    resultCount={displayJobs.length}
                    onClearCity={() => setCityFilter('')}
                  />
                )}

                <div className="space-y-2">
                  {itemsWithAds.map((item, i) => {
                    if (item.type === 'ad') {
                      return <AdNativeCard key={`ad-${item.index}`} sponsorIndex={item.index} className="!rounded-xl" />;
                    }
                    const job = item.data;
                    const isNew = (Date.now() - new Date(job.created_at).getTime()) < 48 * 3600 * 1000;
                    const oppLabel = job.opportunity_type === 'emprego' ? 'Emprego' : job.opportunity_type === 'freelance' ? 'Freelance' : 'Serviço';
                    const oppColor = job.opportunity_type === 'emprego' ? 'bg-blue-50 text-blue-700 border-blue-200' : job.opportunity_type === 'freelance' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-accent/10 text-accent border-accent/20';

                    return (
                      <Link
                        key={job.id}
                        to={`/vaga/${job.slug || job.id}`}
                        className="group flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-accent/30 sm:gap-4 sm:p-4"
                      >
                        {/* Icon */}
                        <div className="hidden shrink-0 sm:block">
                          {job.cover_image_url ? (
                            <img src={job.cover_image_url} alt="" className="h-14 w-14 rounded-lg object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-xl">
                              {(job.categories as any)?.icon || '💼'}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start gap-1.5">
                            <h3 className="min-w-0 flex-1 text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-1">
                              {job.title}
                            </h3>
                            <div className="flex shrink-0 gap-1">
                              {isNew && (
                                <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-700 border border-green-200">NOVA</span>
                              )}
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium border ${oppColor}`}>{oppLabel}</span>
                            </div>
                          </div>

                          {(job.categories as any)?.name && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {(job.categories as any)?.icon} {(job.categories as any)?.name}
                            </p>
                          )}

                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{job.description}</p>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {job.city && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0 text-primary/60" />
                                {job.city}{job.state ? `, ${job.state}` : ''}
                              </span>
                            )}
                            {(job as any).job_type && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">{jobTypeLabel((job as any).job_type)}</span>
                            )}
                            {(job as any).work_model && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">{workModelLabel((job as any).work_model)}</span>
                            )}
                            {(job as any).salary && (
                              <span className="text-[11px] font-medium text-green-700">{(job as any).salary}</span>
                            )}
                          </div>
                        </div>

                        {/* Right column */}
                        <div className="flex shrink-0 flex-col items-end justify-between">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(job.created_at)}</span>
                          {job.whatsapp && (
                            <span className="mt-auto flex items-center gap-0.5 text-[10px] font-medium text-green-600">
                              <MessageCircle className="h-3 w-3" />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                  <nav className="mt-6 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(p => p - 1)}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {paginationRange.map((p, i) => {
                        if (p < 0) {
                          return <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>;
                        }
                        return (
                          <Button
                            key={p}
                            variant={p === page ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPage(p)}
                            className="h-8 w-8 p-0 text-xs"
                          >
                            {p}
                          </Button>
                        );
                      })}

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Mostrando {Math.min((page - 1) * perPage + 1, displayTotal)}-{Math.min(page * perPage, displayTotal)} de {displayTotal} vagas
                    </p>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <FadeInSection>
        <section className="border-t border-border bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 py-8">
          <div className="container px-4 text-center">
            <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">Tem uma vaga para anunciar?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Publique gratuitamente e conecte-se com milhares de profissionais qualificados.
            </p>
            <Button variant="accent" size="lg" className="mt-4 gap-2" asChild>
              <Link to="/dashboard/vagas">
                <Briefcase className="h-4 w-4" /> Publicar Vaga Grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </FadeInSection>

      <Footer />
    </div>
  );
};

export default JobsPage;
