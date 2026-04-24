import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEngagementPoints } from '@/hooks/useEngagementPoints';
import { getEngagementTier } from '@/lib/engagementTiers';
import { Card } from '@/components/ui/card';

interface Signal {
  category_name: string;
  city: string;
  search_count: number;
}

const DemandSignalAlert = () => {
  const { user } = useAuth();
  const { data: points = 0 } = useEngagementPoints(user?.id);
  const tier = getEngagementTier(points);
  const [signals, setSignals] = useState<Signal[]>([]);

  // Restricted to "Ouro" or higher
  const eligible = ['ouro', 'diamante', 'mestre'].includes(tier.tier);

  useEffect(() => {
    if (!user?.id || !eligible) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('get_demand_signal', { _user_id: user.id });
      if (!cancelled && data) setSignals(data as Signal[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, eligible]);

  if (!eligible || signals.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
      >
        <Card className="border-accent/30 bg-gradient-to-r from-accent/5 to-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-accent/15 p-2">
              <Flame className="h-5 w-5 text-accent" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-foreground">Alta demanda detectada</h3>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                {signals.slice(0, 3).map((s, i) => (
                  <li key={i}>
                    <strong className="text-foreground">{s.search_count}</strong> {s.search_count === 1 ? 'pessoa buscou' : 'pessoas buscaram'}{' '}
                    <span className="font-medium text-accent">{s.category_name}</span>
                    {s.city ? <> em <span className="font-medium">{s.city}</span></> : null} nas últimas 24h.
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Mantenha seu perfil ativo e responda rápido para aproveitar o pico.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default DemandSignalAlert;
