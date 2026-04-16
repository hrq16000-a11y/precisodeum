import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, FileText, Star, Briefcase, Zap, X } from 'lucide-react';
import { motion } from 'framer-motion';

const SESSION_KEY = 'admin-flash-dismissed';

interface FlashStats {
  newProviders: number;
  newLeads: number;
  newReviews: number;
  newJobs: number;
  newUsers: number;
}

const AdminFlashSummary = () => {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<FlashStats | null>(null);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(SESSION_KEY);
    if (dismissed === '1') return;

    const since = new Date();
    since.setHours(since.getHours() - 24);
    const sinceISO = since.toISOString();

    (async () => {
      const [providers, leads, reviews, jobs, users] = await Promise.all([
        supabase.from('providers').select('id', { count: 'exact', head: true }).gte('created_at', sinceISO),
        supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', sinceISO),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).gte('created_at', sinceISO),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('created_at', sinceISO),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sinceISO),
      ]);

      const s: FlashStats = {
        newProviders: providers.count ?? 0,
        newLeads: leads.count ?? 0,
        newReviews: reviews.count ?? 0,
        newJobs: jobs.count ?? 0,
        newUsers: users.count ?? 0,
      };

      const total = s.newProviders + s.newLeads + s.newReviews + s.newJobs + s.newUsers;
      if (total > 0) {
        setStats(s);
        setOpen(true);
      }
    })();
  }, []);

  const handleDismiss = () => {
    setOpen(false);
    sessionStorage.setItem(SESSION_KEY, '1');
  };

  if (!stats) return null;

  const items = [
    { label: 'Novos Usuários', value: stats.newUsers, icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Novos Prestadores', value: stats.newProviders, icon: Briefcase, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Novos Leads', value: stats.newLeads, icon: FileText, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    { label: 'Avaliações', value: stats.newReviews, icon: Star, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
    { label: 'Vagas', value: stats.newJobs, icon: Briefcase, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-950/30' },
  ].filter(i => i.value > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50"
              >
                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </motion.div>
              <div>
                <h2 className="text-base font-bold text-foreground">Resumo 24h</h2>
                <p className="text-xs text-muted-foreground">Atividade recente da plataforma</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 grid grid-cols-2 gap-2">
          {items.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-xl p-3 ${item.bg}`}
            >
              <item.icon className={`h-4 w-4 mb-1 ${item.color}`} />
              <p className="text-2xl font-bold text-foreground">{item.value}</p>
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="px-6 pb-5">
          <Button className="w-full" onClick={handleDismiss}>
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminFlashSummary;
