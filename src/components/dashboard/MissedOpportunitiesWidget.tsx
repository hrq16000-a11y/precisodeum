import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Flame, MapPin, Loader2, Zap, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import GlassCard from '@/components/ui/GlassCard';
import { toast } from 'sonner';

interface MissedRow {
  total_searches: number;
  missed_searches: number;
  top_neighborhood: string | null;
  top_city: string | null;
  top_location_label: string | null;
  category_name: string | null;
  hours_offline: number;
}

/**
 * "Sua região está quente!" — mostra ao prestador quantas buscas aconteceram
 * na categoria/cidade dele nas últimas 24h enquanto ele estava offline.
 * Aparece SOMENTE se missed_searches > 0.
 */
export default function MissedOpportunitiesWidget() {
  const { provider, user } = useAuth();
  const qc = useQueryClient();
  const [activating, setActivating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['missed-opportunities', provider?.id],
    enabled: !!provider?.id,
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_missed_opportunities' as any, {
        _provider_id: provider!.id,
      });
      if (error) throw error;
      const arr = (data || []) as MissedRow[];
      return arr.length > 0 ? arr[0] : null;
    },
  });

  const handleGoOnline = async () => {
    if (!user?.id) return;
    setActivating(true);
    try {
      const { error } = await supabase.rpc('track_presence_heartbeat' as any);
      if (error) throw error;
      toast.success('Você está online agora! 🟢', {
        description: 'Aparecerá imediatamente nas próximas buscas da sua região.',
      });
      qc.invalidateQueries({ queryKey: ['missed-opportunities', provider?.id] });
    } catch (e) {
      console.error('[track_presence_heartbeat]', e);
      toast.error('Não foi possível ativar agora.');
    } finally {
      setActivating(false);
    }
  };

  if (!provider?.id) return null;
  if (isLoading) return null;
  if (!data || Number(data.missed_searches) <= 0) return null;

  const missed = Number(data.missed_searches);
  const location = data.top_location_label || data.top_city || 'sua região';
  const category = data.category_name || 'sua categoria';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <GlassCard
        variant="default"
        className="overflow-hidden border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600">
            <Flame className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold text-foreground">
              Sua região está quente! 🔥
            </h3>
            <p className="mt-1 text-sm text-foreground/80">
              Enquanto você estava fora, <strong className="text-orange-700 dark:text-orange-400">{missed} {missed === 1 ? 'pessoa buscou' : 'pessoas buscaram'}</strong> por {category}
              {data.top_location_label ? (
                <> em <span className="inline-flex items-center gap-0.5 font-semibold"><MapPin className="h-3 w-3" />{location}</span></>
              ) : null}.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <EyeOff className="h-3 w-3" />
              Você ficou ~{Math.round(data.hours_offline)}h offline nas últimas 24h.
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleGoOnline}
            disabled={activating}
            className="gap-1.5 bg-orange-600 text-white hover:bg-orange-700"
          >
            {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Ficar Online Agora
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Profissionais online aparecem primeiro nas buscas (peso 0.50 no ranking).
          </p>
        </div>
      </GlassCard>
    </motion.div>
  );
}
