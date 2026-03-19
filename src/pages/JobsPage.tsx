import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Briefcase, Search, MessageCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

const JobsPage = () => {
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  useSeoHead({
    title: 'Vagas e Oportunidades de Serviço | Preciso de um',
    description: 'Encontre vagas de trabalho e oportunidades de serviço na sua cidade. Pedreiro, eletricista, encanador e muito mais.',
    canonical: `${SITE_BASE_URL}/vagas`,
  });

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs-list', search, cityFilter],
    queryFn: async () => {
      let query = supabase
        .from('jobs' as any)
        .select('*, categories(name, slug, icon)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (search) query = query.ilike('title', `%${search}%`);
      if (cityFilter) query = query.ilike('city', `%${cityFilter}%`);

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
          <Button variant="accent" asChild>
            <Link to="/dashboard/vagas">Publicar Vaga</Link>
          </Button>
        </div>

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
