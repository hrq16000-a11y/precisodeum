import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Crown, ArrowRight, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Link } from 'react-router-dom';

const RankingStatus = () => {
  const { provider, profile } = useAuth();
  const { levelName, levelColor } = usePermissions();
  const [position, setPosition] = useState<number | null>(null);
  const [totalInCity, setTotalInCity] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!provider?.id || !provider?.city) { setLoading(false); return; }

    (async () => {
      // Count approved providers in same city
      const { count: total } = await supabase
        .from('providers')
        .select('id', { count: 'exact', head: true })
        .eq('city', provider.city)
        .eq('status', 'approved')
        .is('deleted_at', null);

      setTotalInCity(total ?? 0);

      // Estimate position: count providers with more engagement points
      const myPoints = profile?.engagement_points || 0;
      const { count: ahead } = await supabase
        .from('providers')
        .select('id, profiles!inner(engagement_points)', { count: 'exact', head: true })
        .eq('city', provider.city)
        .eq('status', 'approved')
        .is('deleted_at', null)
        .gt('profiles.engagement_points', myPoints);

      setPosition((ahead ?? 0) + 1);
      setLoading(false);
    })();
  }, [provider?.id, provider?.city, profile?.engagement_points]);

  if (loading || !provider?.city || position === null) return null;

  const isTop5 = position <= 5;
  const isTop10 = position <= 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4 sm:p-5 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-24 h-24 rounded-full blur-3xl opacity-10 bg-accent" />

      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isTop5 ? 'bg-amber-500/15' : 'bg-accent/10'}`}>
          {isTop5 ? <Crown className="h-5 w-5 text-amber-500" /> : <TrendingUp className="h-5 w-5 text-accent" />}
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Seu Ranking Local</h3>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {provider.city} - {provider.state}
          </p>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="text-center"
        >
          <span className={`text-3xl font-black ${isTop5 ? 'text-amber-500' : isTop10 ? 'text-accent' : 'text-foreground'}`}>
            #{position}
          </span>
          <p className="text-[10px] text-muted-foreground">de {totalInCity}</p>
        </motion.div>

        <div className="flex-1 min-w-0">
          {isTop5 ? (
            <p className="text-xs font-semibold text-amber-600">
              🏆 Top 5 na sua região! Continue assim.
            </p>
          ) : isTop10 ? (
            <p className="text-xs font-medium text-accent">
              🔥 Quase no Top 5! Cadastre mais serviços.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Complete seu perfil e cadastre serviços para subir.
            </p>
          )}
        </div>
      </div>

      {!isTop5 && (
        <Link
          to="/dashboard/servicos"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-accent/10 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Subir no Ranking
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </motion.div>
  );
};

export default RankingStatus;
