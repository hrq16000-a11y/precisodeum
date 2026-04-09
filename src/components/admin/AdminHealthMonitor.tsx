import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock, Users, Briefcase, Image, FolderOpen, Activity } from 'lucide-react';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

interface HealthItem {
  label: string;
  status: 'ok' | 'warn' | 'critical';
  value: string;
  icon: React.ElementType;
}

const AdminHealthMonitor = () => {
  const [items, setItems] = useState<HealthItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const [
        profilesRes,
        providersRes,
        pendingRes,
        categoriesRes,
        emptyCategories,
      ] = await Promise.all([
        supabase.from('profiles').select('id, avatar_url, full_name', { count: 'exact' }),
        supabase.from('providers').select('id, description, photo_url, category_id', { count: 'exact' }).eq('status', 'approved'),
        supabase.from('providers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.rpc('audit_user_ref_full' as any),
      ]);

      const profiles = profilesRes.data || [];
      const providers = providersRes.data || [];
      const totalProfiles = profilesRes.count ?? 0;
      const totalProviders = providersRes.count ?? 0;
      const pendingCount = pendingRes.count ?? 0;

      // Incomplete profiles (missing avatar or name)
      const incompleteProfiles = profiles.filter((p: any) => !p.avatar_url || !p.full_name || p.full_name.trim().length < 3).length;
      const incompletePercent = totalProfiles > 0 ? Math.round((incompleteProfiles / totalProfiles) * 100) : 0;

      // Providers without description or photo
      const incompleteProviders = providers.filter((p: any) => !p.description || p.description.length < 20 || !p.photo_url).length;
      const incProvPercent = totalProviders > 0 ? Math.round((incompleteProviders / totalProviders) * 100) : 0;

      // Providers without category
      const noCat = providers.filter((p: any) => !p.category_id).length;

      const healthItems: HealthItem[] = [
        {
          label: 'Perfis incompletos',
          status: incompletePercent > 50 ? 'critical' : incompletePercent > 20 ? 'warn' : 'ok',
          value: `${incompleteProfiles}/${totalProfiles} (${incompletePercent}%)`,
          icon: Users,
        },
        {
          label: 'Prestadores incompletos',
          status: incProvPercent > 50 ? 'critical' : incProvPercent > 20 ? 'warn' : 'ok',
          value: `${incompleteProviders}/${totalProviders} (${incProvPercent}%)`,
          icon: Briefcase,
        },
        {
          label: 'Pendentes de aprovação',
          status: pendingCount > 10 ? 'critical' : pendingCount > 0 ? 'warn' : 'ok',
          value: `${pendingCount}`,
          icon: Clock,
        },
        {
          label: 'Sem categoria definida',
          status: noCat > 5 ? 'warn' : 'ok',
          value: `${noCat} prestadores`,
          icon: FolderOpen,
        },
      ];

      setItems(healthItems);
      setLoading(false);
    };

    check();
  }, []);

  if (loading) return null;

  const overallStatus = items.some(i => i.status === 'critical') ? 'critical'
    : items.some(i => i.status === 'warn') ? 'warn' : 'ok';

  const statusConfig = {
    ok: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Saudável', borderColor: 'border-emerald-200 dark:border-emerald-800' },
    warn: { color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Atenção', borderColor: 'border-amber-200 dark:border-amber-800' },
    critical: { color: 'text-red-500', bg: 'bg-red-500/10', label: 'Crítico', borderColor: 'border-red-200 dark:border-red-800' },
  };

  const overall = statusConfig[overallStatus];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={`rounded-2xl border ${overall.borderColor} bg-card p-4 shadow-sm`}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${overall.bg}`}>
          <Activity className={`h-4 w-4 ${overall.color}`} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            Saúde do Conteúdo
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${overall.bg} ${overall.color}`}>
              {overallStatus === 'ok' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
              {overall.label}
            </span>
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {items.map((item, i) => {
          const Icon = item.icon;
          const cfg = statusConfig[item.status];
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.05 }}
              className={`flex items-center gap-2.5 rounded-xl border ${cfg.borderColor} ${cfg.bg} p-2.5`}
            >
              <Icon className={`h-3.5 w-3.5 ${cfg.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground truncate">{item.label}</p>
                <p className={`text-xs font-bold ${cfg.color}`}>{item.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default AdminHealthMonitor;
