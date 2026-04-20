import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MapPin } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FeedItem {
  id: string;
  actor_alias: string;
  action_text: string;
  icon: string;
  city: string | null;
  category_name: string | null;
  created_at: string;
  is_seed: boolean;
}

const MAX_ITEMS = 10;

const CommunityFeed = () => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadFeed = async () => {
      const { data, error } = await supabase.rpc('get_community_feed', { _limit: MAX_ITEMS });
      if (!mounted || error || !data) return;
      setItems(data as FeedItem[]);
    };

    loadFeed();

    // Realtime: prepend new real activities as they come in
    const channel = supabase
      .channel('public_activities_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'public_activities' },
        (payload) => {
          const fresh = payload.new as FeedItem;
          if (fresh.is_seed) return;
          setItems(prev => {
            if (prev.some(i => i.id === fresh.id)) return prev;
            return [fresh, ...prev].slice(0, MAX_ITEMS);
          });
          setHighlightId(fresh.id);
          setTimeout(() => setHighlightId(null), 4000);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
            <Sparkles className="h-4 w-4 text-purple-500" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Comunidade</h3>
        </div>
        {/* AO VIVO badge */}
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Ao vivo
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -16, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ delay: highlightId === item.id ? 0 : i * 0.04, type: 'spring', stiffness: 300, damping: 28 }}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
                highlightId === item.id
                  ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'hover:bg-muted/40'
              }`}
            >
              <CategoryIcon icon={item.icon || 'Sparkles'} size={16} className="text-foreground shrink-0" />
              <p className="text-[11px] text-foreground flex-1 min-w-0 truncate">
                <span className="font-semibold">{item.actor_alias}</span> {item.action_text}
                {item.city && (
                  <span className="text-muted-foreground"> em {item.city}</span>
                )}
                {item.category_name && (
                  <span className="text-muted-foreground"> • {item.category_name}</span>
                )}
              </p>
              <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                {item.city && <MapPin className="h-2.5 w-2.5" />}
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default CommunityFeed;
