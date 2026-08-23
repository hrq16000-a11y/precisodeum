/**
 * Card de alertas por limiar do Search Console.
 *
 * Lê/salva os limiares em `site_settings.gsc_alert_thresholds` e avalia a
 * amostra atual de cobertura com os helpers puros de `gscThresholds.ts`.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, HelpCircle, Save } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DEFAULT_GSC_THRESHOLDS,
  evaluateGscThresholds,
  parseGscThresholds,
  serializeGscThresholds,
  type GscThresholds,
  type GscThresholdSample,
} from '@/lib/seo/gscThresholds';

const SETTING_KEY = 'gsc_alert_thresholds';

const FIELDS: Array<{ key: keyof GscThresholds; label: string; hint: string; max?: number }> = [
  { key: 'minIndexedRatio', label: 'Indexação mínima (%)', hint: 'Abaixo disso vira alerta crítico', max: 100 },
  { key: 'minImpressions', label: 'Impressões mínimas', hint: 'Janela atual do Search Console' },
  { key: 'minClicks', label: 'Cliques mínimos', hint: 'Janela atual do Search Console' },
  { key: 'maxSitemapErrors', label: 'Máx. sitemaps com erro', hint: 'Acima disso vira alerta crítico' },
];

interface Props {
  sample: GscThresholdSample;
}

const GscThresholdAlertsCard = ({ sample }: Props) => {
  const qc = useQueryClient();
  const [thresholds, setThresholds] = useState<GscThresholds>(DEFAULT_GSC_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('key, value')
        .eq('key', SETTING_KEY)
        .maybeSingle();
      if (!alive) return;
      setThresholds(parseGscThresholds((data as any)?.value ?? null));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: SETTING_KEY, value: serializeGscThresholds(thresholds) }, { onConflict: 'key' });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success('Limiares de alerta salvos.');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao salvar limiares');
    } finally {
      setSaving(false);
    }
  }, [thresholds, qc]);

  const { statuses, alerts } = evaluateGscThresholds(sample, thresholds);

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <BellRing className="h-4 w-4 text-accent" aria-hidden />
        <h2 className="text-lg font-semibold">Alertas por limiar (Search Console)</h2>
        {alerts.length > 0 ? (
          <Badge variant="destructive">{alerts.length} alerta(s)</Badge>
        ) : (
          <Badge variant="outline">Dentro do configurado</Badge>
        )}
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
        {FIELDS.map((f) => (
          <div key={String(f.key)} className="space-y-1">
            <Label htmlFor={`gsc-th-${String(f.key)}`} className="text-xs">
              {f.label}
            </Label>
            <Input
              id={`gsc-th-${String(f.key)}`}
              type="number"
              min={0}
              max={f.max}
              disabled={loading}
              value={thresholds[f.key]}
              onChange={(e) =>
                setThresholds((prev) => ({ ...prev, [f.key]: Number(e.target.value) || 0 }))
              }
            />
            <p className="text-[11px] text-muted-foreground">{f.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving || loading}>
          <Save className="mr-2 h-4 w-4" aria-hidden />
          {saving ? 'Salvando…' : 'Salvar limiares'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setThresholds(DEFAULT_GSC_THRESHOLDS)}
          disabled={saving || loading}
        >
          Restaurar padrão
        </Button>
      </div>

      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))]">
        {statuses.map((s) => {
          const Icon = s.status === 'alert' ? AlertTriangle : s.status === 'ok' ? CheckCircle2 : HelpCircle;
          const tone =
            s.status === 'alert'
              ? 'border-destructive/40 text-destructive'
              : s.status === 'ok'
                ? 'border-emerald-500/40 text-emerald-600'
                : 'border-border text-muted-foreground';
          return (
            <div key={s.metric} className={`flex items-start gap-2 rounded-lg border p-3 ${tone}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground">
                  {s.value == null ? 'sem dados' : `atual ${s.value}`} · limite {s.threshold}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default GscThresholdAlertsCard;
