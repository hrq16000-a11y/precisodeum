import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, MessageCircle, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

interface LeadAnalyticsProps {
  providerId?: string | null;
}

interface DayBucket {
  label: string;
  views: number;
  clicks: number;
  phoneClicks: number;
}

/**
 * LeadAnalytics — "Resultado do Esforço".
 * Dashboard widget showing the last 30 days of:
 *  • profile_view  — how many people opened the public page
 *  • whatsapp_click — how many tapped the WhatsApp CTA
 *
 * Reads aggregated stats from get_lead_stats(provider_id), keeping heavy audit_log
 * grouping on the backend instead of processing raw logs in the browser.
 */
const LeadAnalytics = ({ providerId }: LeadAnalyticsProps) => {
  const [views, setViews] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [phoneClicks, setPhoneClicks] = useState(0);
  const [series, setSeries] = useState<DayBucket[]>([]);
  const [loading, setLoading] = useState(true);

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
      const buckets = (stats.series || []).slice(-14).map((row: any) => ({
        label: row.label,
        views: Number(row.views) || 0,
        clicks: Number(row.whatsapp_clicks) || 0,
        phoneClicks: Number(row.phone_clicks) || 0,
      }));

      setViews(Number(stats.views) || 0);
      setClicks(Number(stats.whatsapp_clicks) || 0);
      setPhoneClicks(Number(stats.phone_clicks) || 0);
      setSeries(buckets);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [providerId]);

  const conversion = useMemo(() => {
    if (views === 0) return 0;
    return Math.round(((clicks + phoneClicks) / views) * 100);
  }, [views, clicks, phoneClicks]);

  const peak = useMemo(
    () => Math.max(1, ...series.map((s) => Math.max(s.views, s.clicks))),
    [series],
  );

  if (!providerId) return null;
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <BarChart3 className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Resultado do seu Perfil</h3>
          <p className="text-[11px] text-muted-foreground">Últimos 30 dias</p>
        </div>
        {conversion > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-600">
            <TrendingUp className="h-3 w-3" />
            {conversion}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Metric icon={Eye} label="Visualizações" value={views} accent="hsl(217 91% 60%)" />
        <Metric icon={MessageCircle} label="Cliques no WhatsApp" value={clicks} accent="hsl(142 71% 45%)" />
      </div>

      {/* Mini sparkline (last 14 days) */}
      {series.length > 0 && (views > 0 || clicks > 0) && (
        <div className="mt-4">
          <div className="flex items-end gap-[3px] h-14">
            {series.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-[2px] justify-end">
                <div
                  className="w-full rounded-sm bg-primary/70"
                  style={{ height: `${Math.max(2, (b.views / peak) * 36)}px` }}
                  title={`${b.label} • ${b.views} views`}
                />
                <div
                  className="w-full rounded-sm bg-emerald-500/70"
                  style={{ height: `${Math.max(2, (b.clicks / peak) * 16)}px` }}
                  title={`${b.label} • ${b.clicks} cliques`}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground">
            <span>{series[0]?.label}</span>
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-sm bg-primary/70" /> Views
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-sm bg-emerald-500/70" /> Cliques
              </span>
            </span>
            <span>{series[series.length - 1]?.label}</span>
          </div>
        </div>
      )}

      {views === 0 && clicks === 0 && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Compartilhe seu perfil para começar a registrar resultados.
        </p>
      )}
    </motion.div>
  );
};

const Metric = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number;
  accent: string;
}) => (
  <div className="rounded-xl border border-border bg-background/60 p-3">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
    <AnimatedCounter
      value={value}
      className="font-display text-2xl font-bold text-foreground block leading-none"
    />
  </div>
);

export default LeadAnalytics;
