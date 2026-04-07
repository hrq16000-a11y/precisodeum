import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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

  if (data.length === 0 || data.every(d => d.leads === 0)) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-sm font-bold text-foreground mb-4">Leads nos últimos 6 meses</h3>
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
    </div>
  );
};

export default LeadsChart;
