import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGeoCity } from '@/hooks/useGeoCity';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import { motion } from 'framer-motion';

const ActiveProvidersCounter = () => {
  const { city: geoCity } = useGeoCity();

  const { data: count } = useQuery({
    queryKey: ['active-providers-count', geoCity],
    queryFn: async () => {
      let query = supabase
        .from('providers')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .is('deleted_at', null);

      if (geoCity) {
        query = query.ilike('city', geoCity);
      }

      const { count: c } = await query;
      return c || 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (!count || count === 0) return null;

  const cityLabel = geoCity || 'na plataforma';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="container py-3"
    >
      <div className="flex items-center justify-center gap-2 rounded-xl bg-accent/5 border border-accent/10 px-4 py-3 text-sm">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-muted-foreground">
          <AnimatedCounter value={count} className="font-bold text-foreground" />{' '}
          profissionais prontos para te atender em{' '}
          <span className="font-semibold text-foreground">{cityLabel}</span> agora
        </span>
      </div>
    </motion.div>
  );
};

export default ActiveProvidersCounter;
