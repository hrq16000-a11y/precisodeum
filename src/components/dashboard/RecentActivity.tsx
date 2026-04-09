import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Star, Briefcase, Eye, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Activity {
  id: string;
  type: 'lead' | 'review' | 'service_view';
  title: string;
  subtitle: string;
  time: string;
  icon: React.ElementType;
  color: string;
}

interface RecentActivityProps {
  providerId: string;
}

const RecentActivity = ({ providerId }: RecentActivityProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [leadsRes, reviewsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, client_name, service_needed, created_at')
          .eq('provider_id', providerId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('reviews')
          .select('id, rating, comment, created_at')
          .eq('provider_id', providerId)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      const items: Activity[] = [];

      (leadsRes.data || []).forEach(l => {
        items.push({
          id: `lead-${l.id}`,
          type: 'lead',
          title: l.client_name || 'Novo lead',
          subtitle: l.service_needed || 'Solicitou orçamento',
          time: l.created_at,
          icon: MessageSquare,
          color: 'text-blue-500 bg-blue-500/10',
        });
      });

      (reviewsRes.data || []).forEach(r => {
        items.push({
          id: `review-${r.id}`,
          type: 'review',
          title: `Avaliação ${r.rating}★`,
          subtitle: r.comment?.slice(0, 60) || 'Nova avaliação recebida',
          time: r.created_at,
          icon: Star,
          color: 'text-amber-500 bg-amber-500/10',
        });
      });

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setActivities(items.slice(0, 6));
      setLoading(false);
    };
    fetch();
  }, [providerId]);

  if (loading) return null;
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Leads e avaliações aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity, i) => {
        const Icon = activity.icon;
        return (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-muted/40 transition-colors"
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${activity.color}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{activity.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{activity.subtitle}</p>
            </div>
            <span className="text-[10px] text-muted-foreground/60 shrink-0 pt-0.5">
              {formatDistanceToNow(new Date(activity.time), { addSuffix: true, locale: ptBR })}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};

export default RecentActivity;
