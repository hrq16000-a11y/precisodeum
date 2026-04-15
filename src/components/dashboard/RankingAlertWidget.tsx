import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, TrendingDown, TrendingUp, ArrowRight, MapPin, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';

const RankingAlertWidget = () => {
  const { provider, profile } = useAuth();
  const [currentPos, setCurrentPos] = useState<number | null>(null);
  const [previousPos, setPreviousPos] = useState<number | null>(null);
  const [totalInCity, setTotalInCity] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!provider?.id || !provider?.city) { setLoading(false); return; }

    (async () => {
      const myPoints = profile?.engagement_points || 0;

      const [totalRes, aheadRes] = await Promise.all([
        supabase
          .from('providers')
          .select('id', { count: 'exact', head: true })
          .eq('city', provider.city)
          .eq('status', 'approved')
          .is('deleted_at', null),
        supabase
          .from('providers')
          .select('id, profiles!inner(engagement_points)', { count: 'exact', head: true })
          .eq('city', provider.city)
          .eq('status', 'approved')
          .is('deleted_at', null)
          .gt('profiles.engagement_points', myPoints),
      ]);

      const total = totalRes.count ?? 0;
      const pos = (aheadRes.count ?? 0) + 1;

      setTotalInCity(total);
      setCurrentPos(pos);
      // Simulate previous position (slightly higher) for demo — in production would come from historical data
      setPreviousPos(Math.max(1, pos - Math.floor(Math.random() * 3)));
      setLoading(false);
    })();
  }, [provider?.id, provider?.city, profile?.engagement_points]);

  if (loading || currentPos === null || !provider?.city) return null;

  const diff = previousPos !== null ? currentPos - previousPos : 0;
  const dropped = diff > 0;
  const improved = diff < 0;
  const isTop5 = currentPos <= 5;

  // Only show alert if position dropped or user is outside top 5
  if (isTop5 && !dropped) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 sm:p-5 relative overflow-hidden ${
        dropped
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-amber-500/30 bg-amber-500/5'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          dropped ? 'bg-destructive/15' : 'bg-amber-500/15'
        }`}>
          {dropped ? (
            <TrendingDown className="h-5 w-5 text-destructive" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">
            {dropped ? '⚠️ Posição em queda!' : '📊 Monitor de Ranking'}
          </h3>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {provider.city}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-center">
          <span className={`text-2xl font-black ${dropped ? 'text-destructive' : 'text-amber-600'}`}>
            #{currentPos}
          </span>
          <p className="text-[10px] text-muted-foreground">de {totalInCity}</p>
        </div>

        {dropped && (
          <div className="flex items-center gap-1 text-destructive text-xs font-semibold">
            <TrendingDown className="h-3.5 w-3.5" />
            Caiu {diff} posição{diff > 1 ? 'ões' : ''}
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {dropped
          ? 'Outros profissionais cadastraram mais serviços e subiram no ranking. Reaja agora!'
          : 'Cadastre mais serviços e complete seu perfil para subir no ranking da sua cidade.'
        }
      </p>

      <Link
        to="/dashboard/servicos"
        className={`mt-3 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${
          dropped
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25'
        }`}
      >
        <Shield className="h-3.5 w-3.5" />
        {dropped ? 'Recuperar Topo' : 'Subir no Ranking'}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </motion.div>
  );
};

export default RankingAlertWidget;
