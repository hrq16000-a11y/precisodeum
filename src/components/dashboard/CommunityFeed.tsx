import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
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

const MAX_ITEMS = 6;

interface CommunityFeedProps {
  /** Compact mode: smaller (~40% reduzido) e oculta totalmente se vazio. */
  compact?: boolean;
}

const CommunityFeed = ({ compact = false }: CommunityFeedProps) => {
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

  // Em modo compacto, oculta totalmente se vazio (RPC já filtra horário comercial).
  if (items.length === 0) return null;

  // Mostra apenas o primeiro nome ("Rafael R." → "Rafael") e remove acrônimos sobrando.
  const firstName = (alias: string) => {
    const cleaned = (alias || '').trim().replace(/\s+/g, ' ');
    const first = cleaned.split(' ')[0] || cleaned;
    // remove ponto final (ex.: "R.")
    return first.replace(/\.$/, '');
  };

  // Deduplica por usuário (alias normalizado), mantendo apenas a ação mais recente.
  // Garante que a sequência nunca repita o mesmo nome em itens consecutivos.
  const seen = new Set<string>();
  const uniqueItems: FeedItem[] = [];
  for (const item of items) {
    const key = firstName(item.actor_alias).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueItems.push(item);
  }

  const displayItems = compact ? uniqueItems.slice(0, 4) : uniqueItems;

  if (displayItems.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={`rounded-xl border border-border bg-card ${compact ? 'p-2.5' : 'p-4'}`}
    >
      <div className={`flex items-center justify-between ${compact ? 'mb-1.5' : 'mb-3'}`}>
        <div className="flex items-center gap-1.5">
          <div className={`flex items-center justify-center rounded-md bg-purple-500/10 ${compact ? 'h-5 w-5' : 'h-8 w-8 rounded-lg'}`}>
            <Sparkles className={`text-purple-500 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
          </div>
          <h3 className={`font-bold text-foreground ${compact ? 'text-[11px]' : 'text-sm'}`}>
            Comunidade
          </h3>
        </div>
        <div className={`flex items-center gap-1 rounded-full bg-emerald-500/10 ${compact ? 'px-1.5 py-0.5' : 'px-2.5 py-1'}`}>
          <span className={`relative flex ${compact ? 'h-1.5 w-1.5' : 'h-2 w-2'}`}>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className={`relative inline-flex rounded-full bg-emerald-500 ${compact ? 'h-1.5 w-1.5' : 'h-2 w-2'}`} />
          </span>
          <span className={`font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
            Ao vivo
          </span>
        </div>
      </div>

      <div className={compact ? 'space-y-0' : 'space-y-1'}>
        <AnimatePresence initial={false}>
          {displayItems.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -12, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ delay: highlightId === item.id ? 0 : i * 0.04, type: 'spring', stiffness: 300, damping: 28 }}
              className={`flex items-center gap-2 rounded-md transition-colors ${
                compact ? 'px-1.5 py-1' : 'px-2 py-1.5 rounded-lg gap-2.5'
              } ${
                highlightId === item.id
                  ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'hover:bg-muted/40'
              }`}
            >
              <CategoryIcon
                icon={item.icon || 'Sparkles'}
                size={compact ? 12 : 16}
                className="text-foreground shrink-0"
              />
              <p className={`text-foreground flex-1 min-w-0 truncate ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                <span className="font-semibold">{firstName(item.actor_alias)}</span> {item.action_text}
                {item.city && (
                  <span className="text-muted-foreground"> em {item.city}</span>
                )}
                {item.category_name && (
                  <span className="text-muted-foreground"> • {item.category_name}</span>
                )}
              </p>
              <span className={`text-muted-foreground shrink-0 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
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
