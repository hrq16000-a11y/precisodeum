/**
 * RolloutControlCard — controle admin do rollout do Onboarding V2.
 *
 * Mostra:
 *  - Estado on/off da flag onboarding_v2_enabled.
 *  - Slider 0-100 para onboarding_v2_rollout_percent.
 *  - KPIs lado-a-lado (V1 vs V2) com taxa de conclusão.
 *  - Botão de rollback seguro (define enabled=false e percent=0) com confirmação.
 *
 * Persistência via RPC `update_site_setting_audited` (audita quem mudou).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Rocket, ShieldAlert, RotateCcw, Loader2, CheckCircle2, XCircle,
  TrendingUp, Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FunnelRow {
  phase: string;
  event: string;
  total: number;
  unique_sessions: number;
  unique_users: number;
}

interface VariantStats {
  enter: number;
  complete: number;
  error: number;
  conversion: number;
}

const ROLLOUT_KEY = 'onboarding_v2_rollout_percent';
const ENABLED_KEY = 'onboarding_v2_enabled';

async function fetchVariantStats(variant: 'v1' | 'v2', days: number): Promise<VariantStats> {
  try {
    const { data, error } = await (supabase as any).rpc('admin_onboarding_funnel', {
      _days: days,
      _variant: variant,
    });
    if (error) throw error;
    const rows = (data || []) as FunnelRow[];
    const totals: Record<string, number> = {};
    for (const r of rows) totals[r.event] = (totals[r.event] || 0) + r.total;
    const enter = totals.enter || 0;
    const complete = totals.complete || 0;
    return {
      enter,
      complete,
      error: totals.error || 0,
      conversion: enter > 0 ? Math.round((complete / enter) * 100) : 0,
    };
  } catch {
    return { enter: 0, complete: 0, error: 0, conversion: 0 };
  }
}

export const RolloutControlCard = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [percent, setPercent] = useState(0);
  const [draftPercent, setDraftPercent] = useState(0);
  const [v1, setV1] = useState<VariantStats | null>(null);
  const [v2, setV2] = useState<VariantStats | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Carrega estado atual + métricas
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('site_settings' as any)
          .select('key, value')
          .in('key', [ENABLED_KEY, ROLLOUT_KEY]);
        if (alive && data) {
          const map: Record<string, string> = {};
          (data as any[]).forEach((r) => { map[r.key] = r.value; });
          const en = map[ENABLED_KEY] === 'true';
          const pc = Math.max(0, Math.min(100, parseInt(map[ROLLOUT_KEY] || '0', 10) || 0));
          setEnabled(en);
          setPercent(pc);
          setDraftPercent(pc);
        }
        const [s1, s2] = await Promise.all([
          fetchVariantStats('v1', 30),
          fetchVariantStats('v2', 30),
        ]);
        if (alive) { setV1(s1); setV2(s2); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  // Auto-refresh das métricas a cada 30s (real-time leve)
  useEffect(() => {
    const id = window.setInterval(() => setReloadKey((k) => k + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const dirty = draftPercent !== percent;

  const persistSetting = async (key: string, value: string): Promise<boolean> => {
    const { error } = await (supabase as any).rpc('update_site_setting_audited', {
      p_key: key, p_value: value,
    });
    if (error) {
      toast.error(`Não consegui salvar ${key}: ${error.message}`);
      return false;
    }
    return true;
  };

  const handleToggleEnabled = async (next: boolean) => {
    setSaving(true);
    try {
      const ok = await persistSetting(ENABLED_KEY, next ? 'true' : 'false');
      if (ok) {
        setEnabled(next);
        toast.success(`Onboarding V2 ${next ? 'habilitado' : 'desabilitado'}.`);
      }
    } finally { setSaving(false); }
  };

  const handleSavePercent = async () => {
    if (draftPercent < 0 || draftPercent > 100) {
      toast.error('Porcentagem deve estar entre 0 e 100.');
      return;
    }
    setSaving(true);
    try {
      const ok = await persistSetting(ROLLOUT_KEY, String(draftPercent));
      if (ok) {
        setPercent(draftPercent);
        toast.success(`Rollout atualizado para ${draftPercent}%.`);
      }
    } finally { setSaving(false); }
  };

  const handleRollback = async () => {
    setSaving(true);
    try {
      const ok1 = await persistSetting(ROLLOUT_KEY, '0');
      const ok2 = await persistSetting(ENABLED_KEY, 'false');
      if (ok1 && ok2) {
        setPercent(0); setDraftPercent(0); setEnabled(false);
        toast.success('Rollback executado: Onboarding V2 desligado para todos.');
      }
    } finally { setSaving(false); }
  };

  const winner = useMemo(() => {
    if (!v1 || !v2) return null;
    if (v1.enter < 20 || v2.enter < 20) return 'inconclusivo';
    if (v2.conversion > v1.conversion + 2) return 'v2';
    if (v1.conversion > v2.conversion + 2) return 'v1';
    return 'empate';
  }, [v1, v2]);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Rocket className="h-5 w-5 text-primary" />
          Controle de Rollout — Onboarding V2
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle on/off */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <div>
            <p className="font-semibold text-foreground text-sm">Habilitado globalmente</p>
            <p className="text-xs text-muted-foreground">
              Quando desligado, todos caem no fluxo V1 (legado), independente do %.
            </p>
          </div>
          {loading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <Switch checked={enabled} disabled={saving} onCheckedChange={handleToggleEnabled} />
          )}
        </div>

        {/* Slider de rollout */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-foreground text-sm">Porcentagem em V2</p>
            <Badge variant="secondary" className="font-bold tabular-nums">
              {loading ? '…' : `${draftPercent}%`}
            </Badge>
          </div>
          {loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <>
              <Slider
                value={[draftPercent]}
                min={0}
                max={100}
                step={5}
                disabled={!enabled || saving}
                onValueChange={(v) => setDraftPercent(v[0] ?? 0)}
                className="w-full"
              />
              <div className="flex flex-wrap items-center gap-2">
                {[0, 5, 25, 50, 75, 100].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!enabled || saving}
                    onClick={() => setDraftPercent(v)}
                    className="h-7 text-xs hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {v}%
                  </Button>
                ))}
                <div className="ml-auto flex gap-2">
                  {dirty && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() => setDraftPercent(percent)}
                      className="h-8"
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={!dirty || saving}
                    onClick={handleSavePercent}
                    className="h-8 hover:opacity-95 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Salvar {draftPercent}%
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Distribuição é determinística por user_id (sticky A/B): o mesmo usuário sempre cai no mesmo fluxo.
              </p>
            </>
          )}
        </div>

        {/* Métricas A/B em tempo real */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Métricas A/B (últimos 30 dias)
            </p>
            <Badge variant="secondary" className="text-[10px]">auto-refresh 30s</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <VariantBox label="V1 (legado)" stats={v1} loading={loading} />
            <VariantBox label="V2 (novo)" stats={v2} loading={loading} highlight />
          </div>
          {winner && winner !== 'inconclusivo' && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              {winner === 'v2' && (
                <>V2 está convertendo mais ({v2!.conversion}% vs {v1!.conversion}%). Considere subir o rollout.</>
              )}
              {winner === 'v1' && (
                <>V1 está convertendo mais ({v1!.conversion}% vs {v2!.conversion}%). Avalie redução do rollout.</>
              )}
              {winner === 'empate' && (
                <>Conversões equivalentes — ganho do V2 é UX, mantenha rollout estável.</>
              )}
            </p>
          )}
          {winner === 'inconclusivo' && (
            <p className="text-[11px] text-muted-foreground">
              Amostra ainda pequena para conclusão estatística. Aguarde mais entradas.
            </p>
          )}
        </div>

        {/* Rollback seguro */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2 mb-2">
            <ShieldAlert className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Rollback seguro</p>
              <p className="text-xs text-amber-800/80">
                Em caso de problema crítico, desligue o V2 imediatamente. Todos os novos usuários voltam para o V1.
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || (!enabled && percent === 0)}
                className="w-full border-amber-500/40 text-amber-800 hover:bg-amber-500/10 focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Executar rollback agora
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar rollback do Onboarding V2?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai DESABILITAR o V2 globalmente e zerar a porcentagem.
                  Novos usuários cairão no fluxo V1 imediatamente. Quem já está dentro do V2 continua até concluir.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRollback} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, executar rollback
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};

interface VariantBoxProps { label: string; stats: VariantStats | null; loading: boolean; highlight?: boolean }
const VariantBox = ({ label, stats, loading, highlight }: VariantBoxProps) => (
  <div className={`rounded-lg border p-3 ${highlight ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'}`}>
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
    {loading || !stats ? (
      <Skeleton className="h-12 w-full" />
    ) : (
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Entradas</span>
          <span className="font-semibold tabular-nums">{stats.enter.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Conclusões
          </span>
          <span className="font-semibold tabular-nums">{stats.complete.toLocaleString('pt-BR')}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-600" /> Erros
          </span>
          <span className="font-semibold tabular-nums">{stats.error.toLocaleString('pt-BR')}</span>
        </div>
        <div className="border-t border-border/50 pt-1 mt-1 flex items-baseline justify-between">
          <span className="text-xs font-semibold text-foreground">Conversão</span>
          <span className={`font-display text-lg font-bold tabular-nums ${stats.conversion >= 50 ? 'text-emerald-600' : 'text-foreground'}`}>
            {stats.conversion}%
          </span>
        </div>
      </div>
    )}
  </div>
);

export default RolloutControlCard;
