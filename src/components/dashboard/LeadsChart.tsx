import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

interface LeadsChartProps {
  providerId: string;
}

const LeadsChart = ({ providerId }: LeadsChartProps) => {
  const [data, setData] = useState<{ month: string; leads: number }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);

      const { data: leads } = await supabase
        .from('leads')
        .select('created_at')
        .eq('provider_id', providerId)
        .gte('created_at', sixMonthsAgo.toISOString());

      if (!leads) return;

      const months: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = 0;
      }

      leads.forEach(l => {
        const d = new Date(l.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (months[key] !== undefined) months[key]++;
      });

      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      setData(
        Object.entries(months).map(([key, count]) => ({
          month: monthNames[parseInt(key.split('-')[1]) - 1],
          leads: count,
        }))
      );
    };

    fetchData();
  }, [providerId]);

  // Insights
  const insights = useMemo(() => {
    if (data.length < 2) return null;
    const current = data[data.length - 1]?.leads ?? 0;
    const previous = data[data.length - 2]?.leads ?? 0;
    const total = data.reduce((sum, d) => sum + d.leads, 0);
    const avg = total / data.length;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let percentChange = 0;
    if (previous > 0) {
      percentChange = Math.round(((current - previous) / previous) * 100);
      trend = percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'stable';
    } else if (current > 0) {
      trend = 'up';
      percentChange = 100;
    }

    return { current, previous, total, avg: Math.round(avg * 10) / 10, trend, percentChange };
  }, [data]);

  if (data.length === 0 || data.every(d => d.leads === 0)) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground">Leads nos últimos 6 meses</h3>
        {insights && (
          <motion.div
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              insights.trend === 'up' ? 'bg-emerald-500/10 text-emerald-600'
              : insights.trend === 'down' ? 'bg-red-500/10 text-red-600'
              : 'bg-muted text-muted-foreground'
            }`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            {insights.trend === 'up' ? <TrendingUp className="h-3 w-3" /> :
             insights.trend === 'down' ? <TrendingDown className="h-3 w-3" /> :
             <Minus className="h-3 w-3" />}
            {insights.percentChange > 0 ? '+' : ''}{insights.percentChange}% vs mês anterior
          </motion.div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Bar dataKey="leads" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Quick stats row */}
      {insights && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-center">
            <p className="text-xs font-bold text-foreground">{insights.total}</p>
            <p className="text-[9px] text-muted-foreground">Total</p>
          </div>
          <div className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-center">
            <p className="text-xs font-bold text-foreground">{insights.avg}</p>
            <p className="text-[9px] text-muted-foreground">Média/mês</p>
          </div>
          <div className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-center">
            <p className="text-xs font-bold text-foreground">{insights.current}</p>
            <p className="text-[9px] text-muted-foreground">Este mês</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsChart;
