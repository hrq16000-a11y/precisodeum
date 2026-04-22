import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Eye, MousePointerClick, Percent, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

interface LeadInsightsProps {
  providerId?: string | null;
}

interface LeadDay {
  label: string;
  views: number;
  contacts: number;
}

interface TopService {
  service_name: string;
  clicks: number;
}

const LeadInsights = ({ providerId }: LeadInsightsProps) => {
  const [loading, setLoading] = useState(true);
  const [views, setViews] = useState(0);
  const [contacts, setContacts] = useState(0);
  const [series, setSeries] = useState<LeadDay[]>([]);
  const [topServices, setTopServices] = useState<TopService[]>([]);

  useEffect(() => {
    if (!providerId) {
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await (supabase.rpc as any)('get_lead_stats', { provider_id: providerId });
      if (!active) return;

      const stats = (data || {}) as any;
      const whatsapp = Number(stats.whatsapp_clicks) || 0;
      const phone = Number(stats.phone_clicks) || 0;
      setViews(Number(stats.views) || 0);
      setContacts(whatsapp + phone);
      setTopServices(((stats.top_services || []) as any[]).map((item) => ({
        service_name: String(item.service_name || 'Perfil geral'),
        clicks: Number(item.clicks) || 0,
      })));
      setSeries(((stats.series || []) as any[]).slice(-14).map((row) => ({
        label: String(row.label || ''),
        views: Number(row.views) || 0,
        contacts: (Number(row.whatsapp_clicks) || 0) + (Number(row.phone_clicks) || 0),
      })));
      setLoading(false);
    })();

    return () => { active = false; };
  }, [providerId]);

  const conversion = useMemo(() => (views > 0 ? Math.round((contacts / views) * 100) : 0), [contacts, views]);

  if (!providerId) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-base font-bold text-foreground">Insights de Leads</h2>
          <p className="text-xs text-muted-foreground">Serviços com mais intenção de contato nos últimos 30 dias.</p>
        </div>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <InsightMetric icon={Eye} label="Visualizações" value={views} />
              <InsightMetric icon={MousePointerClick} label="Cliques" value={contacts} />
              <InsightMetric icon={Percent} label="Conversão" value={conversion} suffix="%" />
            </div>
            <div className="h-44 rounded-xl border border-border bg-background/50 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                  <Bar dataKey="views" name="Visualizações" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="contacts" name="Cliques" fill="hsl(var(--accent))" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/50 p-3">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <Trophy className="h-4 w-4 text-accent" /> Top 3 Serviços
            </h3>
            <div className="space-y-2">
              {topServices.length > 0 ? topServices.map((service, index) => (
                <div key={`${service.service_name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{service.service_name}</p>
                    <p className="text-[11px] text-muted-foreground">#{index + 1} em intenção de contato</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent/10 px-2 py-1 text-xs font-bold text-accent">{service.clicks}</span>
                </div>
              )) : (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Os serviços aparecerão aqui quando os visitantes clicarem para contato.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const InsightMetric = ({ icon: Icon, label, value, suffix = '' }: { icon: any; label: string; value: number; suffix?: string }) => (
  <div className="rounded-xl border border-border bg-background/60 p-3">
    <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
    </div>
    <div className="flex items-baseline gap-0.5 font-display text-xl font-bold text-foreground">
      <AnimatedCounter value={value} />
      {suffix && <span className="text-sm">{suffix}</span>}
    </div>
  </div>
);

export default LeadInsights;