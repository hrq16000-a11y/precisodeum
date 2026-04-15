import { useMemo, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Briefcase, ArrowRight, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import FadeInSection from '@/components/FadeInSection';
import AdNativeCard from '@/components/ads/AdNativeCard';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Agora';
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

const typeColors: Record<string, string> = {
  emprego: 'bg-green-500/10 text-green-700 dark:text-green-400',
  freelance: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  servico: 'bg-accent/10 text-accent',
};

const AD_EVERY = 4;

const FeaturedJobs = () => {
  const { data: jobs = [] } = useQuery({
    queryKey: ['featured-jobs-home'],
    queryFn: async () => {
      const { data } = await (supabase
        .from('jobs')
        .select('id, title, city, state, opportunity_type, slug, whatsapp, description, job_type, work_model, created_at, categories(name, icon)') as any)
        .eq('status', 'active')
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);
      return shuffle(data || []).slice(0, 3);
    },
    staleTime: 1000 * 60 * 15,
  });

  if (jobs.length === 0) return null;

  return (
    <section className="bg-gradient-to-b from-muted/40 to-background py-8">
      <div className="container">
        <FadeInSection>
          <div className="mb-4 flex items-center justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent mb-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                Oportunidades
              </div>
              <h2 className="font-display text-lg font-bold text-foreground">Vagas em Destaque</h2>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0 rounded-full">
              <Link to="/vagas">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>
        </FadeInSection>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job: any) => {
            const typeClass = typeColors[job.opportunity_type] || typeColors.servico;
            const ago = timeAgo(job.created_at);

            return (
              <Link
                key={job.id}
                to={`/vaga/${job.slug || job.id}`}
                className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-accent/30 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <CategoryIcon icon={(job.categories as any)?.icon || 'Briefcase'} size={18} className="text-accent" />
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeClass}`}>
                      {job.opportunity_type === 'emprego' ? 'Emprego' : job.opportunity_type === 'freelance' ? 'Freelance' : 'Serviço'}
                    </span>
                    {job.work_model && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{job.work_model}</span>
                    )}
                  </div>
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />{ago}
                  </span>
                </div>

                <h3 className="font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words">
                  {job.title}
                </h3>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-auto">
                  {job.city && (
                    <span className="flex items-center gap-0.5 truncate">
                      <MapPin className="h-3 w-3 shrink-0 text-primary/60" />{job.city}{job.state ? `, ${job.state}` : ''}
                    </span>
                  )}
                  {job.whatsapp && (
                    <span className="flex items-center gap-0.5 text-accent font-medium shrink-0 ml-auto">
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 flex justify-center">
          <Button variant="accent" size="sm" asChild className="rounded-full shadow-sm">
            <Link to="/dashboard/vagas">
              <Briefcase className="mr-1.5 h-3.5 w-3.5" /> Cadastre uma vaga grátis
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedJobs;
