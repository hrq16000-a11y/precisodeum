import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Briefcase, MessageSquare, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

const AdminGrowthChart = () => {
  const [chartData, setChartData] = useState<{ day: string; signups: number; leads: number }[]>([]);
  const [totals, setTotals] = useState({ signups7d: 0, leads7d: 0, signupsPrev: 0, leadsPrev: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const now = new Date();
      const d14 = new Date(now);
      d14.setDate(d14.getDate() - 14);

      const [profilesRes, leadsRes] = await Promise.all([
        supabase.from('profiles').select('created_at').gte('created_at', d14.toISOString()),
        supabase.from('leads').select('created_at').gte('created_at', d14.toISOString()),
      ]);

      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const days: Record<string, { signups: number; leads: number }> = {};
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        days[key] = { signups: 0, leads: 0 };
      }

      let signups7d = 0, leads7d = 0, signupsPrev = 0, leadsPrev = 0;
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      (profilesRes.data || []).forEach((p: any) => {
        const date = new Date(p.created_at);
        const key = date.toISOString().split('T')[0];
        if (days[key]) {
          days[key].signups++;
          signups7d++;
        } else if (date < sevenDaysAgo) {
          signupsPrev++;
        }
      });

      (leadsRes.data || []).forEach((l: any) => {
        const date = new Date(l.created_at);
        const key = date.toISOString().split('T')[0];
        if (days[key]) {
          days[key].leads++;
          leads7d++;
        } else if (date < sevenDaysAgo) {
          leadsPrev++;
        }
      });

      const data = Object.entries(days).map(([key, val]) => {
        const d = new Date(key);
        return {
          day: dayNames[d.getDay()],
          signups: val.signups,
          leads: val.leads,
        };
      });

      setChartData(data);
      setTotals({ signups7d, leads7d, signupsPrev, leadsPrev });
      setLoading(false);
    };

    fetch();
  }, []);

  if (loading) return null;

  const signupChange = totals.signupsPrev > 0
    ? Math.round(((totals.signups7d - totals.signupsPrev) / totals.signupsPrev) * 100)
    : totals.signups7d > 0 ? 100 : 0;

  const leadChange = totals.leadsPrev > 0
    ? Math.round(((totals.leads7d - totals.leadsPrev) / totals.leadsPrev) * 100)
    : totals.leads7d > 0 ? 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Crescimento 7 dias</h3>
          <p className="text-[10px] text-muted-foreground">Cadastros e leads da última semana</p>
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl bg-muted/40 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="h-3 w-3 text-primary" />
            <span className="text-[10px] text-muted-foreground">Cadastros</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AnimatedCounter value={totals.signups7d} className="text-lg font-bold text-foreground" />
            {signupChange !== 0 && (
              <span className={`inline-flex items-center text-[9px] font-semibold ${signupChange > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {signupChange > 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                {Math.abs(signupChange)}%
              </span>
            )}
          </div>
        </div>
        <div className="rounded-xl bg-muted/40 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare className="h-3 w-3 text-accent" />
            <span className="text-[10px] text-muted-foreground">Leads</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AnimatedCounter value={totals.leads7d} className="text-lg font-bold text-foreground" />
            {leadChange !== 0 && (
              <span className={`inline-flex items-center text-[9px] font-semibold ${leadChange > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {leadChange > 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                {Math.abs(leadChange)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, padding: '4px 8px' }}
          />
          <Area type="monotone" dataKey="signups" stroke="hsl(var(--primary))" fill="url(#signupGrad)" strokeWidth={2} name="Cadastros" />
          <Area type="monotone" dataKey="leads" stroke="hsl(var(--accent))" fill="url(#leadGrad)" strokeWidth={2} name="Leads" />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default AdminGrowthChart;
