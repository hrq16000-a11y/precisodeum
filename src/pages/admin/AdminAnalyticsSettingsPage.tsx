import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GA4_ID_REGEX, GTM_ID_REGEX } from '@/lib/analyticsLoader';

const KEYS = {
  enabled: 'analytics_enabled',
  ga4: 'ga4_measurement_id',
  gtm: 'gtm_container_id',
} as const;

const LABELS: Record<string, { label: string; description: string }> = {
  [KEYS.enabled]: { label: 'Analytics ativo', description: 'Liga/desliga GA4 e GTM em todo o portal' },
  [KEYS.ga4]: { label: 'Google Analytics 4', description: 'ID de medição GA4 (G-XXXXXXXXXX)' },
  [KEYS.gtm]: { label: 'Google Tag Manager', description: 'ID do contêiner GTM (GTM-XXXXXXX)' },
};

/**
 * Gestão de Analytics 100% pelo painel: os IDs ficam em `site_settings`,
 * são lidos em runtime pelo AnalyticsLoader e respeitam o consentimento LGPD.
 */
const AdminAnalyticsSettingsPage = () => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [ga4, setGa4] = useState('');
  const [gtm, setGtm] = useState('');
  const [existing, setExisting] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('site_settings' as any)
        .select('key, value')
        .in('key', [KEYS.enabled, KEYS.ga4, KEYS.gtm]);
      if (error) toast.error('Não foi possível carregar as configurações.');
      const rows = (data || []) as any[];
      setExisting(new Set(rows.map((r) => r.key)));
      setEnabled(rows.find((r) => r.key === KEYS.enabled)?.value === 'true');
      setGa4(rows.find((r) => r.key === KEYS.ga4)?.value || '');
      setGtm(rows.find((r) => r.key === KEYS.gtm)?.value || '');
      setLoading(false);
    })();
  }, []);

  const persist = async (key: string, value: string) => {
    if (existing.has(key)) {
      const { error } = await (supabase.rpc as any)('update_site_setting_audited', { p_key: key, p_value: value });
      if (error) throw new Error(error.message);
    } else {
      const meta = LABELS[key];
      const { error } = await (supabase.from('site_settings' as any) as any)
        .insert([{ key, value, label: meta.label, description: meta.description }]);
      if (error) throw new Error(error.message);
      setExisting((prev) => new Set(prev).add(key));
    }
  };

  const handleSave = async () => {
    const ga4Clean = ga4.trim().toUpperCase();
    const gtmClean = gtm.trim().toUpperCase();
    if (ga4Clean && !GA4_ID_REGEX.test(ga4Clean)) {
      toast.error('ID do GA4 inválido. Use o formato G-XXXXXXXXXX.');
      return;
    }
    if (gtmClean && !GTM_ID_REGEX.test(gtmClean)) {
      toast.error('ID do GTM inválido. Use o formato GTM-XXXXXXX.');
      return;
    }
    setSaving(true);
    try {
      await persist(KEYS.enabled, enabled ? 'true' : 'false');
      await persist(KEYS.ga4, ga4Clean);
      await persist(KEYS.gtm, gtmClean);
      setGa4(ga4Clean);
      setGtm(gtmClean);
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success('Analytics atualizado. Recarregue o site para aplicar aos visitantes.');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="motion-enter space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Analytics (GA4 / Tag Manager)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie o rastreamento sem precisar de deploy. Os IDs são aplicados em tempo de execução.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
          <CardDescription>Deixe em branco para desativar um dos serviços.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="analytics-enabled">Analytics ativo</Label>
              <p className="text-xs text-muted-foreground">Kill switch global de GA4 e GTM.</p>
            </div>
            <Switch id="analytics-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ga4">ID de medição do GA4</Label>
            <Input id="ga4" value={ga4} placeholder="G-XXXXXXXXXX" onChange={(e) => setGa4(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gtm">ID do contêiner GTM (opcional)</Label>
            <Input id="gtm" value={gtm} placeholder="GTM-XXXXXXX" onChange={(e) => setGtm(e.target.value)} />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              O carregamento respeita o consentimento LGPD: o Consent Mode v2 inicia negado e só é liberado
              após o visitante aceitar cookies de análise.
            </span>
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalyticsSettingsPage;
