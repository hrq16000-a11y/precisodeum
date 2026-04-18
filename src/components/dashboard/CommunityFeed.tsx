import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, TrendingUp, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FeedItem {
  id: string;
  message: string;
  icon: string;
  time: string;
  color: string;
}

const CommunityFeed = () => {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    (async () => {
      // Fetch recent level-up events from audit_log
      const { data } = await supabase
        .from('audit_log')
        .select('id, user_id, action, details, created_at')
        .eq('action', 'level_changed')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!data || data.length === 0) return;

      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, level_id')
        .in('id', userIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      // Get level names
      const levelIds = data.map(d => (d.details as any)?.new_level_id).filter(Boolean);
      const { data: levels } = await supabase
        .from('gamification_levels')
        .select('id, name, icon, color')
        .in('id', levelIds);

      const levelMap: Record<string, any> = {};
      (levels || []).forEach(l => { levelMap[l.id] = l; });

      const feed: FeedItem[] = data.map(d => {
        const prof = profileMap[d.user_id];
        const firstName = prof?.full_name?.split(' ')[0] || 'Profissional';
        const newLevel = levelMap[(d.details as any)?.new_level_id];
        const levelName = newLevel?.name || 'novo nível';
        const levelIcon = newLevel?.icon || '🏆';

        return {
          id: d.id,
          message: `${firstName} subiu para ${levelIcon} ${levelName}!`,
          icon: levelIcon,
          time: d.created_at,
          color: newLevel?.color || '#8B5CF6',
        };
      });

      setItems(feed);
    })();
  }, []);

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
          <Sparkles className="h-4 w-4 text-purple-500" />
        </div>
        <h3 className="text-sm font-bold text-foreground">Comunidade</h3>
      </div>

      <div className="space-y-1">
        <AnimatePresence>
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors"
            >
              <CategoryIcon icon={item.icon} size={16} className="text-foreground shrink-0" />
              <p className="text-[11px] text-foreground flex-1 min-w-0 truncate">{item.message}</p>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(item.time), { addSuffix: true, locale: ptBR })}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default CommunityFeed;
