/**
 * SignupFunnelCard — funil completo de cadastro:
 * Visitantes → Wizard iniciado → Rascunhos salvos → Perfis → Profissionais.
 * Lê via RPC admin_signup_funnel(_days). Sem PII.
 */
import { useEffect, useMemo, useState } from 'react';
import { Users, FileText, UserPlus, Briefcase, Eye, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Row {
  day: string;
  visitors: number;
  wizard_started: number;
  drafts_saved: number;
  profiles_created: number;
  providers_created: number;
}

const STEP_META = [
  { key: 'visitors', label: 'Visitantes', Icon: Eye, color: 'text-sky-700 bg-sky-500/10' },
  { key: 'wizard_started', label: 'Wizard iniciado', Icon: Users, color: 'text-violet-700 bg-violet-500/10' },
  { key: 'drafts_saved', label: 'Rascunhos salvos', Icon: FileText, color: 'text-amber-700 bg-amber-500/10' },
  { key: 'profiles_created', label: 'Perfis criados', Icon: UserPlus, color: 'text-emerald-700 bg-emerald-500/10' },
  { key: 'providers_created', label: 'Profissionais finalizados', Icon: Briefcase, color: 'text-emerald-800 bg-emerald-600/15' },
] as const;

const SignupFunnelCard = () => {
  const [days, setDays] = useState('14');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('admin_signup_funnel', {
        _days: Number(days) || 14,
      });
      if (error) throw error;
      setRows((data || []) as Row[]);
    } catch (e: any) {
      toast.error('Falha ao carregar funil de cadastro: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [days]);

  const totals = useMemo(() => {
    const t = { visitors: 0, wizard_started: 0, drafts_saved: 0, profiles_created: 0, providers_created: 0 };
    for (const r of rows) {
      t.visitors += r.visitors;
      t.wizard_started += r.wizard_started;
      t.drafts_saved += r.drafts_saved;
      t.profiles_created += r.profiles_created;
      t.providers_created += r.providers_created;
    }
    return t;
  }, [rows]);

  const conversionPct = totals.visitors
    ? Math.round((totals.providers_created / totals.visitors) * 100)
    : 0;
  const maxVal = Math.max(1, ...STEP_META.map((s) => totals[s.key as keyof typeof totals]));

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Funil completo de cadastro
            </h2>
            <p className="text-xs text-muted-foreground">
              Da visita ao profissional ativo. Conversão geral: <span className="font-semibold text-foreground">{conversionPct}%</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Últimas 48h</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Etapas do funil com barra horizontal */}
        <div className="space-y-2">
          {STEP_META.map((step) => {
            const v = totals[step.key as keyof typeof totals];
            const pct = totals.visitors ? Math.round((v / totals.visitors) * 100) : 0;
            const widthPct = (v / maxVal) * 100;
            return (
              <div key={step.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${step.color}`}>
                      <step.Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium text-foreground truncate">{step.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 tabular-nums">
                    <span className="font-bold text-foreground">{v.toLocaleString('pt-BR')}</span>
                    <span className="text-xs text-muted-foreground w-12 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  {loading ? (
                    <Skeleton className="h-full w-1/2" />
                  ) : (
                    <div
                      className={`h-full rounded-full transition-all ${step.color.split(' ')[1]}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabela diária */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-2 py-2 text-left">Dia</th>
                {STEP_META.map((s) => (
                  <th key={s.key} className="px-2 py-2 text-right">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="p-4"><Skeleton className="h-6 w-full" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Sem dados no período.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.day} className="border-t border-border hover:bg-muted/30">
                  <td className="px-2 py-1.5 font-medium text-foreground">
                    {new Date(r.day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </td>
                  {STEP_META.map((s) => (
                    <td key={s.key} className="px-2 py-1.5 text-right tabular-nums text-foreground">
                      {(r[s.key as keyof Row] as number).toLocaleString('pt-BR')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default SignupFunnelCard;
