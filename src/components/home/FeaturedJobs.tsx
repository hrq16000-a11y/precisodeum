import { useMemo, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Briefcase, ArrowRight, ChevronUp, ChevronDown, Clock } from 'lucide-react';
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
        .limit(12);
      return shuffle(data || []).slice(0, 6);
    },
    staleTime: 1000 * 60 * 5,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 10);
    setCanScrollDown(el.scrollTop < el.scrollHeight - el.clientHeight - 10);
  }, []);

  const scroll = useCallback((dir: 'up' | 'down') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: dir === 'up' ? -240 : 240, behavior: 'smooth' });
  }, []);

  // Build interleaved items list
  const items = useMemo(() => {
    const list: { type: 'job' | 'ad'; data?: any; adIdx?: number }[] = [];
    let adCount = 0;
    jobs.forEach((job, i) => {
      list.push({ type: 'job', data: job });
      if ((i + 1) % AD_EVERY === 0 && i < jobs.length - 1) {
        list.push({ type: 'ad', adIdx: adCount++ });
      }
    });
    return list;
  }, [jobs]);

  if (jobs.length === 0) return null;

  // Hero = first job
  const hero: any = jobs[0];
  const heroType = typeColors[hero.opportunity_type] || typeColors.servico;

  return (
    <section className="bg-gradient-to-b from-muted/40 to-background py-10">
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
              {items.length > 4 && (
                <div className="hidden sm:flex flex-col gap-1">
                  <button onClick={() => scroll('up')} disabled={!canScrollUp} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors border border-border">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => scroll('down')} disabled={!canScrollDown} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors border border-border">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              )}
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex shrink-0 rounded-full">
                <Link to="/vagas">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
          </div>
        </FadeInSection>

        {/* Portal-style grid: hero left + scrollable list right */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          {/* Hero card */}
          <Link
            to={`/vaga/${hero.slug || hero.id}`}
            className="group relative flex flex-col justify-end overflow-hidden rounded-xl border border-border bg-gradient-to-br from-accent/10 via-card to-card p-6 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 min-h-[280px]"
          >
            <span className="absolute top-4 left-4 z-10">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${heroType}`}>
                {hero.opportunity_type === 'emprego' ? 'Emprego' : hero.opportunity_type === 'freelance' ? 'Freelance' : 'Serviço'}
              </span>
            </span>
            <span className="absolute top-4 right-4 flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />{timeAgo(hero.created_at)}
            </span>

            <h3 className="font-display text-lg font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words">
              {hero.title}
            </h3>
            {hero.description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{hero.description}</p>
            )}
            <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
              {hero.city && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary/60" />{hero.city}{hero.state ? `, ${hero.state}` : ''}</span>
              )}
              {hero.work_model && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{hero.work_model}</span>
              )}
              {hero.whatsapp && (
                <span className="flex items-center gap-1 text-accent font-medium ml-auto"><MessageCircle className="h-3 w-3" /> WhatsApp</span>
              )}
            </div>
          </Link>

          {/* Scrollable list */}
          <div className="relative">
            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className="flex flex-col gap-2.5 overflow-y-auto scrollbar-hide max-h-[400px] pr-1"
            >
              {items.slice(1).map((item, idx) => {
                if (item.type === 'ad') {
                  return (
                    <AdNativeCard
                      key={`ad-${item.adIdx}`}
                      sponsorIndex={item.adIdx}
                      className="flex-shrink-0"
                    />
                  );
                }
                const job = item.data;
                const typeClass = typeColors[job.opportunity_type] || typeColors.servico;
                const ago = timeAgo(job.created_at);

                return (
                  <Link
                    key={job.id}
                    to={`/vaga/${job.slug || job.id}`}
                    className="group flex items-start gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-accent/30"
                  >
                    {/* Icon / category */}
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-lg">
                      {(job.categories as any)?.icon || '💼'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeClass}`}>
                          {job.opportunity_type === 'emprego' ? 'Emprego' : job.opportunity_type === 'freelance' ? 'Freelance' : 'Serviço'}
                        </span>
                        {job.work_model && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{job.work_model}</span>
                        )}
                        <span className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />{ago}
                        </span>
                      </div>
                      <h3 className="mt-1 font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-1 break-words">
                        {job.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        {job.city && (
                          <span className="flex items-center gap-0.5 truncate">
                            <MapPin className="h-3 w-3 shrink-0 text-primary/60" />{job.city}
                          </span>
                        )}
                        {job.whatsapp && (
                          <span className="flex items-center gap-0.5 text-accent font-medium shrink-0 ml-auto">
                            <MessageCircle className="h-3 w-3" /> WhatsApp
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Fade gradients */}
            {canScrollUp && (
              <div className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background/80 to-transparent rounded-t-xl" />
            )}
            {canScrollDown && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background/80 to-transparent rounded-b-xl" />
            )}
          </div>
        </div>

        {/* CTAs */}
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
