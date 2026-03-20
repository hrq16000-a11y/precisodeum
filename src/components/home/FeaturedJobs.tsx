import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FeaturedJobs = () => {
  const { data: jobs = [] } = useQuery({
    queryKey: ['featured-jobs-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id, title, city, state, opportunity_type, slug, whatsapp, categories(name, icon)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(12);
      return shuffle(data || []).slice(0, 4);
    },
    staleTime: 1000 * 60 * 5,
  });

  if (jobs.length === 0) return null;

  return (
    <section className="py-10">
      <div className="container">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Vagas em Destaque</h2>
            <p className="mt-1 text-sm text-muted-foreground">Oportunidades recentes de serviço e trabalho</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/vagas">Ver todas</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {jobs.map((job: any) => (
            <Link
              key={job.id}
              to={`/vaga/${job.slug || job.id}`}
              className="group rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-lg hover:border-accent/30"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                  {job.opportunity_type === 'emprego' ? 'Emprego' : job.opportunity_type === 'freelance' ? 'Freelance' : 'Serviço'}
                </span>
                {(job.categories as any)?.name && (
                  <span className="text-[10px] text-muted-foreground">{(job.categories as any)?.icon} {(job.categories as any)?.name}</span>
                )}
              </div>
              <h3 className="mt-2 font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2">
                {job.title}
              </h3>
              {job.city && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />{job.city}{job.state ? `, ${job.state}` : ''}
                </p>
              )}
              {job.whatsapp && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-green-600">
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </p>
              )}
            </Link>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Button variant="accent" asChild>
            <Link to="/dashboard/vagas">
              <Briefcase className="mr-2 h-4 w-4" /> Cadastre uma vaga / oportunidade
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedJobs;
