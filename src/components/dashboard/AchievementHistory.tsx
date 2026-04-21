import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Briefcase, Image as ImageIcon, User, Sparkles, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Achievement {
  id: string;
  title: string;
  date: string;
  icon: typeof Trophy;
  cls: string;
}

const ACTION_MAP: Record<string, { title: string; icon: typeof Trophy; cls: string }> = {
  service_create_atomic: { title: 'Serviço cadastrado', icon: Briefcase, cls: 'text-blue-600 bg-blue-500/10' },
  album_create_atomic: { title: 'Álbum criado', icon: ImageIcon, cls: 'text-pink-600 bg-pink-500/10' },
  portfolio_photo_atomic: { title: 'Foto adicionada ao portfólio', icon: ImageIcon, cls: 'text-pink-600 bg-pink-500/10' },
  profile_update: { title: 'Perfil atualizado', icon: User, cls: 'text-emerald-600 bg-emerald-500/10' },
  level_up: { title: 'Novo nível alcançado', icon: Star, cls: 'text-amber-600 bg-amber-500/10' },
};

/**
 * AchievementHistory — "Mural de Conquistas".
 * Lists the user's last 5 wins so they SEE the platform recording their effort.
 */
const AchievementHistory = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('audit_log')
        .select('id, action, created_at, details')
        .eq('user_id', user.id)
        .in('action', Object.keys(ACTION_MAP))
        .order('created_at', { ascending: false })
        .limit(5);

      const mapped = (data || []).map((row: any) => {
        const meta = ACTION_MAP[row.action] || { title: row.action, icon: Trophy, cls: 'text-muted-foreground bg-muted' };
        return {
          id: row.id,
          title: meta.title,
          date: row.created_at,
          icon: meta.icon,
          cls: meta.cls,
        } as Achievement;
      });
      setItems(mapped);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading || items.length === 0) return null;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins} min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d atrás`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-600">
          <Trophy className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            Mural de Conquistas
            <Sparkles className="h-3 w-3 text-amber-500" />
          </h3>
          <p className="text-[11px] text-muted-foreground">Suas últimas vitórias na plataforma</p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5"
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${item.cls}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className="flex-1 text-xs font-medium text-foreground truncate">{item.title}</p>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(item.date)}</span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
};

export default AchievementHistory;
