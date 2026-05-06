import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Briefcase, Search, MessageCircle, Filter } from 'lucide-react';
import GeoFallbackBanner from '@/components/GeoFallbackBanner';
import GeoLocationChip from '@/components/GeoLocationChip';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useGeoCity } from '@/hooks/useGeoCity';
import AdBanner from '@/components/ads/AdBanner';
import AdSidebar from '@/components/ads/AdSidebar';
import AdNativeCard from '@/components/ads/AdNativeCard';
import { lazy, Suspense } from 'react';
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

const NATIVE_AD_INTERVAL = 5;

const JobsPage = () => {
  const { city: geoCity } = useGeoCity();
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [workModelFilter, setWorkModelFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [geoApplied, setGeoApplied] = useState(false);

  // Auto-fill city filter from geo on first load
  useEffect(() => {
    if (geoCity && !geoApplied && !cityFilter) {
      setCityFilter(geoCity);
      setGeoApplied(true);
    }
  }, [geoCity, geoApplied, cityFilter]);

  const seoCity = cityFilter || geoCity || '';
  useSeoHead({
    title: seoCity ? `Vagas em ${seoCity} | Preciso de um` : 'Vagas e Oportunidades de Serviço | Preciso de um',
    description: seoCity
      ? `Encontre vagas de trabalho e oportunidades de serviço em ${seoCity}.`
      : 'Encontre vagas de trabalho e oportunidades de serviço na sua cidade.',
    canonical: `${SITE_BASE_URL}/vagas`,
  });

  const buildJobsQuery = (withCity: boolean) => async () => {
    let query = (supabase
      .from('jobs')
      .select('*, categories(name, slug, icon)')
      .eq('status', 'active') as any)
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false });
    if (search) query = query.ilike('title', `%${search}%`);
    if (withCity && cityFilter) query = query.ilike('city', `%${cityFilter}%`);
    if (jobTypeFilter) query = query.eq('job_type' as any, jobTypeFilter);
    if (workModelFilter) query = query.eq('work_model' as any, workModelFilter);
    const { data } = await query.limit(50);
    return data || [];
  };

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs-list', search, cityFilter, jobTypeFilter, workModelFilter],
    queryFn: buildJobsQuery(true),
  });

  // Fallback query without city filter (only runs when city is set)
  const { data: jobsNoCityFilter = [] } = useQuery({
    queryKey: ['jobs-list-noCity', search, jobTypeFilter, workModelFilter],
    queryFn: buildJobsQuery(false),
    enabled: !!cityFilter,
    staleTime: 1000 * 60 * 5,
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

  const jobTypeLabel = (v: string) => JOB_TYPES.find(t => t.value === v)?.label || v;
  const workModelLabel = (v: string) => WORK_MODELS.find(t => t.value === v)?.label || v;

  let nativeAdCount = 0;
  const itemsWithAds: Array<{ type: 'job'; data: any } | { type: 'ad'; index: number }> = [];
  displayJobs.forEach((job: any, i: number) => {
    itemsWithAds.push({ type: 'job', data: job });
    if ((i + 1) % NATIVE_AD_INTERVAL === 0) {
      itemsWithAds.push({ type: 'ad', index: nativeAdCount++ });
    }
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <Suspense fallback={null}><AdSlot slotSlug="jobs-top" city={cityFilter} /></Suspense>
      <div className="container px-4 py-6 sm:py-8">
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          {seoCity ? `Vagas em ${seoCity}` : 'Vagas e Oportunidades'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">
          {seoCity
            ? `Encontre oportunidades de serviço e trabalho em ${seoCity}`
            : 'Encontre oportunidades de serviço e trabalho na sua região'}
        </p>

        {/* Filters — stacked on mobile */}
        <div className="mt-5 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar vagas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* City + action buttons */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground sm:w-auto sm:min-w-[180px]"
            >
              <option value="">Todas as cidades</option>
              {cities.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
            <GeoLocationChip />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="mr-1 h-4 w-4" /> Filtros
              </Button>
              <Button variant="accent" size="sm" className="flex-1 sm:flex-none" asChild>
                <Link to="/dashboard/vagas">Publicar Vaga</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <select value={jobTypeFilter} onChange={(e) => setJobTypeFilter(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground sm:w-auto">
              {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={workModelFilter} onChange={(e) => setWorkModelFilter(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground sm:w-auto">
              {WORK_MODELS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {(jobTypeFilter || workModelFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setJobTypeFilter(''); setWorkModelFilter(''); }}>Limpar filtros</Button>
            )}
          </div>
        )}

        {/* Layout: content + sidebar */}
        <div className="mt-6 flex gap-6">
          {/* Main content */}
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
              </div>
            ) : displayJobs.length === 0 ? (
              <div className="mt-12 text-center sm:mt-16">
                <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium text-foreground">Nenhuma vaga encontrada</p>
                <p className="mt-1 text-sm text-muted-foreground">Seja o primeiro a publicar uma oportunidade!</p>
                <Button variant="accent" className="mt-4" asChild>
                  <Link to="/dashboard/vagas">Publicar Vaga</Link>
                </Button>
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
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {itemsWithAds.map((item, i) => {
                  if (item.type === 'ad') {
                    return <AdNativeCard key={`ad-${item.index}`} sponsorIndex={item.index} />;
                  }
                  const job = item.data;
                  return (
                    <Link
                      key={job.id}
                      to={`/vaga/${job.slug || job.id}`}
                      className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-lg hover:border-accent/30 sm:p-5"
                    >
                      {job.cover_image_url && (
                        <img src={job.cover_image_url} alt={job.title} className="mb-3 aspect-video w-full rounded-lg object-cover" loading="lazy" />
                      )}
                      <div className="flex flex-wrap items-start gap-2">
                        <h3 className="min-w-0 flex-1 font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words sm:text-base">{job.title}</h3>
                        <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          {job.opportunity_type === 'emprego' ? 'Emprego' : job.opportunity_type === 'freelance' ? 'Freelance' : 'Serviço'}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(job as any).job_type && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{jobTypeLabel((job as any).job_type)}</span>
                        )}
                        {(job as any).work_model && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{workModelLabel((job as any).work_model)}</span>
                        )}
                      </div>
                      {(job.categories as any)?.name && (
                        <p className="mt-1 text-xs text-muted-foreground truncate">{(job.categories as any)?.icon} {(job.categories as any)?.name}</p>
                      )}
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2 break-words">{job.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {job.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{job.city}{job.state ? `, ${job.state}` : ''}</span></span>}
                        {job.deadline && <span className="flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" />{job.deadline}</span>}
                      </div>
                      {job.whatsapp && (
                        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-green-600">
                          <MessageCircle className="h-3 w-3" /> WhatsApp disponível
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
              </>
            )}
          </div>

          {/* Sticky sidebar — desktop only */}
          <AdSidebar position="sidebar" />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default JobsPage;
