import { useEffect, useRef, useState, memo } from 'react';
import { Users, Briefcase, MapPin, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import FadeInSection from '@/components/FadeInSection';

function useCountUp(target: number, duration = 2000, enabled = true) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || target === 0 || started.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            setValue(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration, enabled]);

  return { value, ref };
}

const stats = [
  { key: 'providers', label: 'Profissionais', icon: Users, suffix: '+', color: 'text-primary' },
  { key: 'services', label: 'Serviços', icon: Briefcase, suffix: '+', color: 'text-accent' },
  { key: 'cities', label: 'Cidades', icon: MapPin, suffix: '+', color: 'text-secondary' },
  { key: 'reviews', label: 'Avaliações', icon: Star, suffix: '+', color: 'text-primary' },
] as const;

const StatItem = memo(({ stat, value }: { stat: typeof stats[number]; value: number }) => {
  const { value: displayed, ref } = useCountUp(value, 1800, value > 0);
  const Icon = stat.icon;

  return (
    <div ref={ref} className="group flex flex-col items-center gap-2 py-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md">
        <Icon className={`h-6 w-6 ${stat.color}`} />
      </div>
      <span className="font-display text-2xl font-extrabold text-foreground tabular-nums md:text-3xl">
        {displayed > 0 ? displayed.toLocaleString('pt-BR') : '—'}
        {displayed > 0 && <span className="text-accent">{stat.suffix}</span>}
      </span>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {stat.label}
      </span>
    </div>
  );
});

StatItem.displayName = 'StatItem';

const StatsCounter = () => {
  const { data } = useQuery({
    queryKey: ['home-stats-counter'],
    queryFn: async () => {
      const [providers, services, cities, reviews] = await Promise.all([
        supabase.from('providers').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('services').select('id', { count: 'exact', head: true }),
        supabase.from('cities').select('id', { count: 'exact', head: true }),
        supabase.from('reviews').select('id', { count: 'exact', head: true }),
      ]);
      return {
        providers: providers.count || 0,
        services: services.count || 0,
        cities: cities.count || 0,
        reviews: reviews.count || 0,
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  const values = data || { providers: 0, services: 0, cities: 0, reviews: 0 };

  return (
    <section className="relative overflow-hidden border-y border-border/50 bg-gradient-to-r from-primary/[0.03] via-background to-accent/[0.03] py-6">
      {/* Decorative dots */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div className="container relative">
        <FadeInSection>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((stat) => (
              <StatItem key={stat.key} stat={stat} value={values[stat.key]} />
            ))}
          </div>
        </FadeInSection>
      </div>
    </section>
  );
};

export default StatsCounter;
