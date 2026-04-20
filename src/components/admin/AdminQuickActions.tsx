import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { UserPlus, FolderPlus, Megaphone, FileText, Image, Settings, Zap, Trophy, Loader2 } from 'lucide-react';
import { useFeatureEnabled } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const qc = useQueryClient();

  const runRecalc = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc('admin_recalculate_all_engagement' as any);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const processed = Number((row as any)?.processed_count ?? 0);
      const total = Number((row as any)?.total_points ?? 0);
      toast.success('Recálculo de gamificação concluído', {
        description: `${processed} perfis atualizados • ${total.toLocaleString('pt-BR')} pontos distribuídos. Os níveis e cores nos cards já refletem o novo ranking.`,
        duration: 7000,
      });
      // Invalida caches que dependem de engagement_points / níveis
      qc.invalidateQueries({ queryKey: ['engagement-points'] });
      qc.invalidateQueries({ queryKey: ['engagement-points-batch'] });
      qc.invalidateQueries({ queryKey: ['featured-providers'] });
      qc.invalidateQueries({ queryKey: ['providers'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-providers'] });
    } catch (e: any) {
      toast.error('Falha ao recalcular', { description: e?.message || 'Erro desconhecido' });
    } finally {
      setRunning(false);
      setConfirmOpen(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-accent" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ações rápidas</span>
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={running}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1.5 text-[11px] font-bold text-amber-800 shadow-sm hover:shadow-md transition-all disabled:opacity-60 dark:from-amber-950/30 dark:to-orange-950/30 dark:text-amber-200"
          title="Recalcula engagement_points de todos os perfis e atualiza níveis (Iniciante → Mestre)"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
          {running ? 'Recalculando…' : 'Recalcular Gamificação'}
        </button>
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Recalcular gamificação de todos os perfis?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação varre todos os profissionais, soma os pontos do <strong>engagement_log</strong> e atualiza
              <strong> engagement_points</strong> + nível (Iniciante, Entusiasta, Engajado, Ouro, Platina, Diamante, Mestre).
              Os cards passarão a exibir as cores e bordas correspondentes ao novo nível imediatamente.
              <br /><br />
              Operação segura e reversível (pode rodar quantas vezes quiser).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runRecalc(); }} disabled={running}>
              {running ? 'Recalculando…' : 'Executar agora'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default AdminQuickActions;
