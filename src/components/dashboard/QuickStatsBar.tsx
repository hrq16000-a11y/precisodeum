import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Eye, MessageSquare, Layout, Zap } from 'lucide-react';

interface QuickStatsBarProps {
  pendingLeads: number;
  providerSlug?: string | null;
}

const QuickStatsBar = ({ pendingLeads, providerSlug }: QuickStatsBarProps) => {
  const navigate = useNavigate();

  const actions = [
    { icon: PlusCircle, label: 'Criar Serviço', path: '/dashboard/servicos', accent: true },
    ...(providerSlug ? [{ icon: Eye, label: 'Ver Página', path: `/profissional/${providerSlug}`, accent: false }] : []),
    { icon: Layout, label: 'Personalizar', path: '/dashboard/minha-pagina', accent: false },
    ...(pendingLeads > 0 ? [{ icon: MessageSquare, label: `Leads (${pendingLeads})`, path: '/dashboard/leads', accent: true }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mt-3"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Zap className="h-3 w-3 text-accent" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ações rápidas</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.path + action.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(action.path)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 ${
                action.accent
                  ? 'bg-accent text-accent-foreground shadow-sm hover:shadow-md'
                  : 'bg-muted/60 text-foreground hover:bg-muted border border-border/50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {action.label}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default QuickStatsBar;
