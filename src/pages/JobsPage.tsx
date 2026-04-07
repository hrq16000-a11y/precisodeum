import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Briefcase, Search, MessageCircle, Filter, Building2, TrendingUp, Users, ChevronDown, X, Sparkles, ArrowRight } from 'lucide-react';
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
import AdSidebar from '@/components/ads/AdSidebar';
import AdNativeCard from '@/components/ads/AdNativeCard';
import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import FadeInSection from '@/components/FadeInSection';

const AdSlot = lazy(() => import('@/components/ads/AdSlot'));

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

const NATIVE_AD_INTERVAL = 6;

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
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [workModelFilter, setWorkModelFilter] = useState('');
  const [opportunityFilter, setOpportunityFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [geoApplied, setGeoApplied] = useState(false);

  useEffect(() => {
    if (geoCity && !geoApplied && !cityFilter) {
      setCityFilter(geoCity);
      setGeoApplied(true);
    }
  }, [geoCity, geoApplied, cityFilter]);

  const seoCity = cityFilter || geoCity || '';
  useSeoHead({
    title: seoCity ? `Vagas em ${seoCity} | Preciso de um` : 'Portal de Vagas | Preciso de um',
    description: seoCity
      ? `Encontre vagas de trabalho e oportunidades de serviço em ${seoCity}.`
      : 'Portal de vagas: encontre oportunidades de trabalho, serviço e freelance na sua cidade.',
    canonical: `${SITE_BASE_URL}/vagas`,
  });

  const activeFiltersCount = [jobTypeFilter, workModelFilter, opportunityFilter].filter(Boolean).length;

  const buildJobsQuery = (withCity: boolean) => async () => {
    let query = (supabase
      .from('jobs')
      .select('*, categories(name, slug, icon)')
      .eq('status', 'active') as any)
      .eq('approval_status', 'approved')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (search) query = query.ilike('title', `%${search}%`);
    if (withCity && cityFilter) query = query.ilike('city', `%${cityFilter}%`);
    if (jobTypeFilter) query = query.eq('job_type' as any, jobTypeFilter);
    if (workModelFilter) query = query.eq('work_model' as any, workModelFilter);
    if (opportunityFilter) query = query.eq('opportunity_type', opportunityFilter);
    const { data } = await query.limit(60);
    return data || [];
  };

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs-list', search, cityFilter, jobTypeFilter, workModelFilter, opportunityFilter],
    queryFn: buildJobsQuery(true),
  });

  const { data: jobsNoCityFilter = [] } = useQuery({
    queryKey: ['jobs-list-noCity', search, jobTypeFilter, workModelFilter, opportunityFilter],
    queryFn: buildJobsQuery(false),
    enabled: !!cityFilter,
    staleTime: 1000 * 60 * 5,
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['jobs-total-count'],
    queryFn: async () => {
      const { count } = await (supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active') as any).eq('approval_status', 'approved').is('deleted_at', null);
      return count || 0;
    },
    staleTime: 1000 * 60 * 10,
  });

  const jobsFallback = jobs.length === 0 && cityFilter && jobsNoCityFilter.length > 0;
  const displayJobs = jobsFallback ? jobsNoCityFilter : jobs;

  const { data: cities = [] } = useQuery({
    queryKey: ['jobs-cities'],
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('name').order('name').limit(50);
      return (data || []).map((c: any) => c.name);
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['jobs-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('name, icon, slug').is('deleted_at', null).order('name');
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const uniqueCities = new Set(displayJobs.map((j: any) => j.city).filter(Boolean));
    const uniqueCategories = new Set(displayJobs.map((j: any) => (j.categories as any)?.name).filter(Boolean));
    return { cities: uniqueCities.size, categories: uniqueCategories.size };
  }, [displayJobs]);

  const jobTypeLabel = (v: string) => JOB_TYPES.find(t => t.value === v)?.label || v;
  const workModelLabel = (v: string) => WORK_MODELS.find(t => t.value === v)?.label || v;

  const clearAllFilters = () => {
    setSearch('');
    setCityFilter('');
    setJobTypeFilter('');
    setWorkModelFilter('');
    setOpportunityFilter('');
  };

  let nativeAdCount = 0;
  const itemsWithAds: Array<{ type: 'job'; data: any } | { type: 'ad'; index: number }> = [];
  displayJobs.forEach((job: any, i: number) => {
    itemsWithAds.push({ type: 'job', data: job });
    if ((i + 1) % NATIVE_AD_INTERVAL === 0) {
      itemsWithAds.push({ type: 'ad', index: nativeAdCount++ });
    }
  });

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Header />

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent/80 py-10 sm:py-14">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
        <div className="container relative z-10 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Portal de Vagas & Oportunidades
            </div>
            <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
              Encontre a vaga ideal{seoCity ? <> em <span className="text-accent">{seoCity}</span></> : ''}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/80 sm:text-base">
              Conecte-se com oportunidades reais de trabalho, serviço e freelance
            </p>

            {/* Search bar */}
            <div className="mx-auto mt-6 max-w-2xl">
              <div className="flex overflow-hidden rounded-xl bg-white shadow-lg">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Cargo, empresa ou palavra-chave..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-12 w-full bg-transparent pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none sm:h-14 sm:text-base"
                  />
                </div>
                <div className="hidden items-center border-l border-border px-1 sm:flex">
                  <select
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
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
            <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
              <div className="flex items-center gap-2 text-white/80">
                <Briefcase className="h-4 w-4" />
                <span className="text-sm font-medium">{totalCount} vagas ativas</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <MapPin className="h-4 w-4" />
                <span className="text-sm font-medium">{stats.cities} cidades</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <Building2 className="h-4 w-4" />
                <span className="text-sm font-medium">{stats.categories} categorias</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Filters bar ── */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Mobile city select */}
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground sm:hidden"
            >
              <option value="">Todas as cidades</option>
              {cities.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>

            <GeoLocationChip />

            {/* Quick filter chips */}
            <div className="flex flex-wrap gap-1.5">
              {OPPORTUNITY_TYPES.slice(1).map(t => (
                <button
                  key={t.value}
                  onClick={() => setOpportunityFilter(opportunityFilter === t.value ? '' : t.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    opportunityFilter === t.value
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="ml-auto gap-1"
            >
              <Filter className="h-3.5 w-3.5" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-[10px]">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            <Button variant="accent" size="sm" asChild className="gap-1">
              <Link to="/dashboard/vagas">
                <Briefcase className="h-3.5 w-3.5" /> Publicar Vaga
              </Link>
            </Button>
          </div>

          {/* Expanded filters panel */}
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 overflow-hidden rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de Contrato</label>
                  <select value={jobTypeFilter} onChange={(e) => setJobTypeFilter(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
                    {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Modelo de Trabalho</label>
                  <select value={workModelFilter} onChange={(e) => setWorkModelFilter(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
                    {WORK_MODELS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {(jobTypeFilter || workModelFilter || opportunityFilter) && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="self-end gap-1">
                    <X className="h-3.5 w-3.5" /> Limpar tudo
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Ads top ── */}
      <Suspense fallback={null}><AdSlot slotSlug="jobs-top" city={cityFilter} /></Suspense>

      {/* ── Main content ── */}
      <div className="container px-4 py-6">
        {/* Results header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Buscando vagas...' : (
                <>
                  <span className="font-semibold text-foreground">{displayJobs.length}</span> vaga{displayJobs.length !== 1 ? 's' : ''} encontrada{displayJobs.length !== 1 ? 's' : ''}
                  {cityFilter && <> em <span className="font-medium text-foreground">{cityFilter}</span></>}
                </>
              )}
            </p>
          </div>
          {/* Active filter tags */}
          {(cityFilter || jobTypeFilter || workModelFilter || opportunityFilter) && (
            <div className="flex flex-wrap gap-1.5">
              {cityFilter && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <MapPin className="h-3 w-3" /> {cityFilter}
                  <button onClick={() => setCityFilter('')} className="ml-0.5 rounded-full p-0.5 hover:bg-muted"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {jobTypeFilter && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  {jobTypeLabel(jobTypeFilter)}
                  <button onClick={() => setJobTypeFilter('')} className="ml-0.5 rounded-full p-0.5 hover:bg-muted"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {workModelFilter && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  {workModelLabel(workModelFilter)}
                  <button onClick={() => setWorkModelFilter('')} className="ml-0.5 rounded-full p-0.5 hover:bg-muted"><X className="h-3 w-3" /></button>
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Content + sidebar layout */}
        <div className="flex gap-6">
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
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
                  <Button variant="accent" asChild>
                    <Link to="/dashboard/vagas">Publicar Vaga</Link>
                  </Button>
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

                <div className="space-y-3">
                  {itemsWithAds.map((item, i) => {
                    if (item.type === 'ad') {
                      return <AdNativeCard key={`ad-${item.index}`} sponsorIndex={item.index} className="!rounded-xl" />;
                    }
                    const job = item.data;
                    const isNew = (Date.now() - new Date(job.created_at).getTime()) < 48 * 3600 * 1000;
                    const oppLabel = job.opportunity_type === 'emprego' ? 'Emprego' : job.opportunity_type === 'freelance' ? 'Freelance' : 'Serviço';
                    const oppColor = job.opportunity_type === 'emprego' ? 'bg-blue-50 text-blue-700 border-blue-200' : job.opportunity_type === 'freelance' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-accent/10 text-accent border-accent/20';

                    return (
                      <FadeInSection key={job.id}>
                        <Link
                          to={`/vaga/${job.slug || job.id}`}
                          className="group flex gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-accent/30 sm:p-5"
                        >
                          {/* Left: icon/image */}
                          <div className="hidden shrink-0 sm:block">
                            {job.cover_image_url ? (
                              <img src={job.cover_image_url} alt="" className="h-16 w-16 rounded-lg object-cover" loading="lazy" />
                            ) : (
                              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-2xl">
                                {(job.categories as any)?.icon || '💼'}
                              </div>
                            )}
                          </div>

                          {/* Center: info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start gap-2">
                              <h3 className="min-w-0 flex-1 font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-1 sm:text-base">
                                {job.title}
                              </h3>
                              <div className="flex shrink-0 gap-1.5">
                                {isNew && (
                                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 border border-green-200">
                                    NOVA
                                  </span>
                                )}
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${oppColor}`}>
                                  {oppLabel}
                                </span>
                              </div>
                            </div>

                            {/* Category */}
                            {(job.categories as any)?.name && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {(job.categories as any)?.icon} {(job.categories as any)?.name}
                              </p>
                            )}

                            {/* Description */}
                            <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{job.description}</p>

                            {/* Meta row */}
                            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                              {job.city && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3 shrink-0 text-primary/60" />
                                  {job.city}{job.state ? `, ${job.state}` : ''}
                                </span>
                              )}
                              {(job as any).job_type && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {jobTypeLabel((job as any).job_type)}
                                </span>
                              )}
                              {(job as any).work_model && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {workModelLabel((job as any).work_model)}
                                </span>
                              )}
                              {(job as any).salary && (
                                <span className="text-xs font-medium text-green-700">
                                  {(job as any).salary}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: time + WhatsApp */}
                          <div className="hidden shrink-0 flex-col items-end justify-between sm:flex">
                            <span className="text-[11px] text-muted-foreground">
                              {timeAgo(job.created_at)}
                            </span>
                            {job.whatsapp && (
                              <span className="mt-auto flex items-center gap-1 text-[11px] font-medium text-green-600">
                                <MessageCircle className="h-3 w-3" /> WhatsApp
                              </span>
                            )}
                          </div>

                          {/* Mobile: time + whatsapp */}
                          <div className="flex flex-col items-end justify-between sm:hidden">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {timeAgo(job.created_at)}
                            </span>
                            {job.whatsapp && (
                              <MessageCircle className="mt-auto h-4 w-4 text-green-600" />
                            )}
                          </div>
                        </Link>
                      </FadeInSection>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Sidebar */}
          <AdSidebar position="sidebar" />
        </div>
      </div>

      {/* ── CTA Section ── */}
      <FadeInSection>
        <section className="border-t border-border bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 py-10">
          <div className="container px-4 text-center">
            <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
              Tem uma vaga para anunciar?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Publique gratuitamente e conecte-se com milhares de profissionais qualificados em todo o Brasil.
            </p>
            <Button variant="accent" size="lg" className="mt-5 gap-2" asChild>
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
