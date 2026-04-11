import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, MessageSquare, User, Camera, Star, ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Action {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  link: string;
  urgency: 'high' | 'medium' | 'low';
  count?: number;
}

const urgencyStyles = {
  high: 'border-destructive/30 bg-destructive/5',
  medium: 'border-amber-400/30 bg-amber-500/5',
  low: 'border-border bg-card',
};

const urgencyDot = {
  high: 'bg-destructive',
  medium: 'bg-amber-500',
  low: 'bg-muted-foreground/30',
};

const ActionQueue = () => {
  const { user, profile, provider } = useAuth();
  const [actions, setActions] = useState<Action[]>([]);

  useEffect(() => {
    if (!user || !provider) return;

    const buildActions = async () => {
      const pending: Action[] = [];

      // 1. Unanswered leads
      const { count: newLeads } = await supabase.from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', provider.id).eq('status', 'new');
      if ((newLeads ?? 0) > 0) {
        pending.push({
          id: 'leads',
          icon: MessageSquare,
          label: `${newLeads} lead${(newLeads ?? 0) > 1 ? 's' : ''} não respondido${(newLeads ?? 0) > 1 ? 's' : ''}`,
          description: 'Responda rapidamente para aumentar suas chances de conversão.',
          link: '/dashboard/leads',
          urgency: 'high',
          count: newLeads ?? 0,
        });
      }

      // 2. Profile incomplete
      const profileMissing = !provider.description?.trim() || !provider.city?.trim() || !profile?.avatar_url;
      if (profileMissing) {
        pending.push({
          id: 'profile',
          icon: User,
          label: 'Perfil incompleto',
          description: 'Adicione foto, descrição e localização para aumentar sua visibilidade.',
          link: '/dashboard/perfil',
          urgency: 'medium',
        });
      }

      // 3. No portfolio
      const { count: albumCount } = await supabase.from('portfolio_albums')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', provider.id);
      if ((albumCount ?? 0) === 0) {
        pending.push({
          id: 'portfolio',
          icon: Camera,
          label: 'Sem portfólio',
          description: 'Adicione fotos dos seus trabalhos para atrair mais clientes.',
          link: '/dashboard/portfolio',
          urgency: 'low',
        });
      }

      // 4. Reviews to respond
      const { count: reviewCount } = await (supabase.from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', provider.id) as any).eq('reply', '');

      setActions(pending);
    };

    buildActions();
  }, [user, provider, profile]);

  if (!actions.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 p-3"
      >
        <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
        <p className="text-xs text-muted-foreground">Tudo em dia! Nenhuma ação pendente.</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
        <AlertCircle className="h-3 w-3" />
        Ações pendentes ({actions.length})
      </h3>
      <div className="space-y-1.5">
        <AnimatePresence>
          {actions.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  to={action.link}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-sm group ${urgencyStyles[action.urgency]}`}
                >
                  <div className="relative shrink-0">
                    <Icon className="h-4 w-4 text-foreground/70" />
                    <span className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${urgencyDot[action.urgency]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{action.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{action.description}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ActionQueue;
