import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Briefcase, MessageSquare, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

interface KpiData {
  label: string;
  value: number;
  prev: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  sparkline: number[];
}

const MiniSparkline = ({ data, color }: { data: number[]; color: string }) => {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const h = 24;
  const w = 56;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');

  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
};

const AdminKpiBar = () => {
  const [kpis, setKpis] = useState<KpiData[]>([]);

  useEffect(() => {
    const fetchKpis = async () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const days7ago = new Date(now.getTime() - 7 * 86400000).toISOString();
      const days14ago = new Date(now.getTime() - 14 * 86400000).toISOString();

      const [usersNow, usersPrev, pendingNow, leadsNow, leadsPrev] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', days7ago),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', days14ago).lt('created_at', days7ago),
        supabase.from('providers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', days7ago),
        supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', days14ago).lt('created_at', days7ago),
      ]);

      // Simple sparkline: fetch daily counts for last 7 days
      const dailyUsers: number[] = [];
      const dailyLeads: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now.getTime() - i * 86400000);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 86400000);
        const [u, l] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true })
            .gte('created_at', dayStart.toISOString()).lt('created_at', dayEnd.toISOString()),
          supabase.from('leads').select('id', { count: 'exact', head: true })
            .gte('created_at', dayStart.toISOString()).lt('created_at', dayEnd.toISOString()),
        ]);
        dailyUsers.push(u.count ?? 0);
        dailyLeads.push(l.count ?? 0);
      }

      setKpis([
        {
          label: 'Novos Usuários',
          value: usersNow.count ?? 0,
          prev: usersPrev.count ?? 0,
          icon: Users,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          sparkline: dailyUsers,
        },
        {
          label: 'Pendentes',
          value: pendingNow.count ?? 0,
          prev: 0,
          icon: Briefcase,
          color: 'text-amber-500',
          bgColor: 'bg-amber-500/10',
          sparkline: [],
        },
        {
          label: 'Leads (7d)',
          value: leadsNow.count ?? 0,
          prev: leadsPrev.count ?? 0,
          icon: MessageSquare,
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/10',
          sparkline: dailyLeads,
        },
      ]);
    };
    fetchKpis();
  }, []);

  if (!kpis.length) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {kpis.map((kpi, i) => {
        const diff = kpi.prev > 0 ? ((kpi.value - kpi.prev) / kpi.prev) * 100 : 0;
        const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
        const trendColor = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-muted-foreground';

        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex-1 min-w-[140px] rounded-2xl border border-border/60 bg-card p-3.5 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`shrink-0 rounded-lg ${kpi.bgColor} p-2`}>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground truncate">{kpi.label}</p>
              <div className="flex items-center gap-1.5">
                <AnimatedCounter value={kpi.value} className="text-lg font-bold text-foreground leading-none" />
                {kpi.prev > 0 && (
                  <span className={`flex items-center gap-0.5 text-[9px] font-medium ${trendColor}`}>
                    <TrendIcon className="h-3 w-3" />
                    {Math.abs(Math.round(diff))}%
                  </span>
                )}
              </div>
            </div>
            {kpi.sparkline.length > 0 && (
              <div className="shrink-0">
                <MiniSparkline data={kpi.sparkline} color={kpi.color === 'text-blue-500' ? '#3b82f6' : '#10b981'} />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default AdminKpiBar;
