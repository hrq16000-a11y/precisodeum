import { useMemo, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Briefcase, ArrowRight, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import FadeInSection from '@/components/FadeInSection';

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
        .limit(18);
      return shuffle(data || []).slice(0, 8);
    },
    staleTime: 1000 * 60 * 5,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
  }, []);

  if (jobs.length === 0) return null;

  return (
    <section className="py-10">
      <div className="container">
        <FadeInSection>
          <div className="mb-5 flex items-center justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent mb-2">
                <Briefcase className="h-3.5 w-3.5" />
                Oportunidades
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">Vagas em Destaque</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Vagas e oportunidades recentes</p>
            </div>
            <div className="flex items-center gap-2">
              {jobs.length > 2 && (
                <div className="hidden sm:flex gap-1">
                  <button onClick={() => scroll('left')} disabled={!canScrollLeft} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors border border-border">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => scroll('right')} disabled={!canScrollRight} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors border border-border">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex shrink-0 rounded-full">
                <Link to="/vagas">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
          </div>
        </FadeInSection>

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {jobs.map((job: any) => {
            const typeClass = typeColors[job.opportunity_type] || typeColors.servico;
            const ago = timeAgo(job.created_at);

            return (
              <Link
                key={job.id}
                to={`/vaga/${job.slug || job.id}`}
                className="group flex w-[270px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-accent/30 hover:-translate-y-0.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${typeClass}`}>
                    {job.opportunity_type === 'emprego' ? 'Emprego' : job.opportunity_type === 'freelance' ? 'Freelance' : 'Serviço'}
                  </span>
                  {job.work_model && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{job.work_model}</span>
                  )}
                  <span className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />{ago}
                  </span>
                </div>

                <h3 className="mt-2.5 font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words">
                  {job.title}
                </h3>

                <div className="mt-auto pt-3 flex items-center justify-between gap-2 border-t border-border/50">
                  {job.city && (
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                      <MapPin className="h-3 w-3 shrink-0 text-primary/60" />{job.city}
                    </p>
                  )}
                  {job.whatsapp && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-accent shrink-0">
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button variant="accent" size="sm" asChild className="w-full sm:w-auto rounded-full shadow-sm">
            <Link to="/dashboard/vagas">
              <Briefcase className="mr-1.5 h-3.5 w-3.5" /> Cadastre uma vaga grátis
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto sm:hidden rounded-full">
            <Link to="/vagas">Ver todas as vagas</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedJobs;
