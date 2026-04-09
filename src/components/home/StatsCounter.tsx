import { useEffect, useRef, useState, memo } from 'react';
import { Users, Briefcase, MapPin, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

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
            const eased = 1 - Math.pow(1 - progress, 3);
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
  { key: 'providers', label: 'Profissionais', icon: Users, suffix: '+', gradient: 'from-blue-500 to-cyan-500' },
  { key: 'services', label: 'Serviços', icon: Briefcase, suffix: '+', gradient: 'from-accent to-amber-500' },
  { key: 'cities', label: 'Cidades', icon: MapPin, suffix: '+', gradient: 'from-emerald-500 to-teal-500' },
] as const;

const StatItem = memo(({ stat, value, index }: { stat: typeof stats[number]; value: number; index: number }) => {
  const { value: displayed, ref } = useCountUp(value, 1800, value > 0);
  const Icon = stat.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative flex flex-col items-center gap-2 py-4 px-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 shadow-sm"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500 rounded-xl`} />
      
      <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${stat.gradient} shadow-md`}>
        <Icon className="h-4 w-4 text-white" />
      </div>

      <div className="text-center relative">
        <span className="font-display text-xl font-extrabold text-foreground tabular-nums md:text-2xl">
          {displayed > 0 ? displayed.toLocaleString('pt-BR') : '—'}
          {displayed > 0 && <span className="text-accent text-lg md:text-xl">{stat.suffix}</span>}
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {stat.label}
        </span>
      </div>
    </motion.div>
  );
});

StatItem.displayName = 'StatItem';

const StatsCounter = () => {
  const { data } = useQuery({
    queryKey: ['home-stats-counter'],
    queryFn: async () => {
      const [providers, services, cities] = await Promise.all([
        supabase.from('providers').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('services').select('id', { count: 'exact', head: true }),
        supabase.from('cities').select('id', { count: 'exact', head: true }),
      ]);
      return {
        providers: providers.count || 0,
        services: services.count || 0,
        cities: cities.count || 0,
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  const values = data || { providers: 0, services: 0, cities: 0, reviews: 0 };

  return (
    <section className="relative overflow-hidden py-12">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-muted/30" />
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 text-center"
        >
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary mb-2">
            📊 Números da Plataforma
          </span>
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Crescendo a cada dia
          </h2>
        </motion.div>
        
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat, i) => (
            <StatItem key={stat.key} stat={stat} value={values[stat.key]} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsCounter;
