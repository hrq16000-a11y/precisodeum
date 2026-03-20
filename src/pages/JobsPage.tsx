import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Briefcase, Search, MessageCircle, Filter } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

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

const JobsPage = () => {
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [workModelFilter, setWorkModelFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useSeoHead({
    title: 'Vagas e Oportunidades de Serviço | Preciso de um',
    description: 'Encontre vagas de trabalho e oportunidades de serviço na sua cidade. Pedreiro, eletricista, encanador e muito mais.',
    canonical: `${SITE_BASE_URL}/vagas`,
  });

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs-list', search, cityFilter, jobTypeFilter, workModelFilter],
    queryFn: async () => {
      let query = supabase
        .from('jobs')
        .select('*, categories(name, slug, icon)')
        .eq('status', 'active')
        .eq('approval_status' as any, 'approved')
        .order('created_at', { ascending: false });

      if (search) query = query.ilike('title', `%${search}%`);
      if (cityFilter) query = query.ilike('city', `%${cityFilter}%`);
      if (jobTypeFilter) query = query.eq('job_type' as any, jobTypeFilter);
      if (workModelFilter) query = query.eq('work_model' as any, workModelFilter);

      const { data } = await query.limit(50);
      return data || [];
    },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ['jobs-cities'],
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('name').order('name').limit(50);
      return (data || []).map((c: any) => c.name);
    },
  });

  const jobTypeLabel = (v: string) => JOB_TYPES.find(t => t.value === v)?.label || v;
  const workModelLabel = (v: string) => WORK_MODELS.find(t => t.value === v)?.label || v;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container py-8">
        <h1 className="font-display text-3xl font-bold text-foreground">Vagas e Oportunidades</h1>
        <p className="mt-2 text-muted-foreground">Encontre oportunidades de serviço e trabalho na sua região</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar vagas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground"
          >
            <option value="">Todas as cidades</option>
            {cities.map((c: string) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-1 h-4 w-4" /> Filtros
          </Button>
          <Button variant="accent" asChild>
            <Link to="/dashboard/vagas">Publicar Vaga</Link>
          </Button>
        </div>

        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-3 rounded-lg border border-border bg-card p-4">
            <select
              value={jobTypeFilter}
              onChange={(e) => setJobTypeFilter(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {JOB_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={workModelFilter}
              onChange={(e) => setWorkModelFilter(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {WORK_MODELS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {(jobTypeFilter || workModelFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setJobTypeFilter(''); setWorkModelFilter(''); }}>
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="mt-16 text-center">
            <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-foreground">Nenhuma vaga encontrada</p>
            <p className="mt-1 text-sm text-muted-foreground">Seja o primeiro a publicar uma oportunidade!</p>
            <Button variant="accent" className="mt-4" asChild>
              <Link to="/dashboard/vagas">Publicar Vaga</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job: any) => (
              <Link
                key={job.id}
                to={`/vaga/${job.slug || job.id}`}
                className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-lg hover:border-accent/30"
              >
                {job.cover_image_url && (
                  <img src={job.cover_image_url} alt={job.title} className="mb-3 h-32 w-full rounded-lg object-cover" loading="lazy" />
                )}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2">{job.title}</h3>
                  <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    {job.opportunity_type === 'emprego' ? 'Emprego' : job.opportunity_type === 'freelance' ? 'Freelance' : 'Serviço'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(job as any).job_type && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{jobTypeLabel((job as any).job_type)}</span>
                  )}
                  {(job as any).work_model && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{workModelLabel((job as any).work_model)}</span>
                  )}
                </div>
                {(job.categories as any)?.name && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(job.categories as any)?.icon} {(job.categories as any)?.name}
                  </p>
                )}
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  {job.city && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.city}{job.state ? `, ${job.state}` : ''}</span>
                  )}
                  {job.deadline && (
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.deadline}</span>
                  )}
                </div>
                {job.whatsapp && (
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-green-600">
                    <MessageCircle className="h-3 w-3" /> WhatsApp disponível
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default JobsPage;
