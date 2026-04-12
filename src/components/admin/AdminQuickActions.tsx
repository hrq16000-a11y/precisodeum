import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { UserPlus, FolderPlus, Megaphone, FileText, Image, Settings, Zap } from 'lucide-react';
import { useFeatureEnabled } from '@/hooks/useSiteSettings';

const allActions = [
  { icon: UserPlus, label: 'Novo Usuário', path: '/admin/usuarios', color: 'text-blue-500 bg-blue-500/10', module: null },
  { icon: FolderPlus, label: 'Nova Categoria', path: '/admin/categorias', color: 'text-emerald-500 bg-emerald-500/10', module: null },
  { icon: Megaphone, label: 'Nova Vaga', path: '/admin/vagas', color: 'text-purple-500 bg-purple-500/10', module: null },
  { icon: FileText, label: 'Novo Post', path: '/admin/blog', color: 'text-amber-500 bg-amber-500/10', module: 'module_blog' },
  { icon: Image, label: 'Mídia', path: '/admin/midia', color: 'text-pink-500 bg-pink-500/10', module: null },
  { icon: Settings, label: 'Configurações', path: '/admin/configuracoes', color: 'text-slate-500 bg-slate-500/10', module: null },
];

const AdminQuickActions = () => {
  const navigate = useNavigate();
  const blogEnabled = useFeatureEnabled('module_blog');
  const actions = useMemo(() => allActions.filter(a => !a.module || (a.module === 'module_blog' && blogEnabled)), [blogEnabled]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center gap-1.5 mb-2.5">
        <Zap className="h-3 w-3 text-accent" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ações rápidas</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.path}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.04 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-card p-3 shadow-sm hover:shadow-md transition-all"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center">{action.label}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default AdminQuickActions;
