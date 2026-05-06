import { useMemo, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Briefcase, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
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
      const { data } = await (supabase
        .from('jobs')
        .select('id, title, city, state, opportunity_type, slug, whatsapp, description, job_type, work_model, categories(name, icon)') as any)
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
    <section className="py-8">
      <div className="container">
        <div className="mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-foreground">Oportunidades em Destaque</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Vagas e oportunidades recentes</p>
          </div>
          <div className="flex items-center gap-2">
            {jobs.length > 2 && (
              <div className="hidden sm:flex gap-1">
                <button
                  onClick={() => scroll('left')}
                  disabled={!canScrollLeft}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => scroll('right')}
                  disabled={!canScrollRight}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex shrink-0">
              <Link to="/vagas">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {jobs.map((job: any) => (
            <Link
              key={job.id}
              to={`/vaga/${job.slug || job.id}`}
              className="group flex w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-card p-3.5 shadow-card transition-all hover:shadow-lg hover:border-accent/30"
            >
              <div className="flex flex-wrap items-center gap-1">
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  {job.opportunity_type === 'emprego' ? 'Emprego' : job.opportunity_type === 'freelance' ? 'Freelance' : 'Serviço'}
                </span>
                {job.work_model && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{job.work_model}</span>
                )}
              </div>
              <h3 className="mt-2 font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words">
                {job.title}
              </h3>
              <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                {job.city && (
                  <p className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                    <MapPin className="h-3 w-3 shrink-0" />{job.city}
                  </p>
                )}
                {job.whatsapp && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-accent shrink-0">
                    <MessageCircle className="h-3 w-3" /> WhatsApp
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button variant="accent" size="sm" asChild className="w-full sm:w-auto">
            <Link to="/dashboard/vagas">
              <Briefcase className="mr-1.5 h-3.5 w-3.5" /> Cadastre uma vaga grátis
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto sm:hidden">
            <Link to="/vagas">Ver todas as vagas</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedJobs;
