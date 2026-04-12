import { useGeoCity } from '@/hooks/useGeoCity';
import { useOnlineCountByCity } from '@/hooks/useOnlinePresence';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import { motion } from 'framer-motion';

const ActiveProvidersCounter = () => {
  const { city: geoCity } = useGeoCity();
  const count = useOnlineCountByCity(geoCity);

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
          {count === 1 ? 'profissional online' : 'profissionais online'} agora em{' '}
          <span className="font-semibold text-foreground">{cityLabel}</span>
        </span>
      </div>
    </motion.div>
  );
};

export default ActiveProvidersCounter;
