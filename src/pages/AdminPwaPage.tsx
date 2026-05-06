import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Smartphone, Download, Eye, MousePointerClick, XCircle, CheckCircle2, BarChart3, Settings, MessageSquare, Monitor, Palette, Clock } from 'lucide-react';
import type { PwaSettings } from '@/hooks/usePwaInstall';

const AdminPwaPage = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PwaSettings | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-pwa-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pwa_install_settings' as any)
        .select('*')
        .limit(1)
        .single();
      return data as unknown as PwaSettings & { id: string };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-pwa-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pwa_install_events' as any)
        .select('event_type, source, device_type, created_at');
      const events = (data || []) as any[];
      return {
        totalImpressions: events.filter(e => e.event_type === 'impression').length,
        totalClicks: events.filter(e => e.event_type === 'cta_click').length,
        totalInstalls: events.filter(e => e.event_type === 'installed').length,
        totalDismissals: events.filter(e => e.event_type === 'dismissed').length,
        bySource: {
          banner: events.filter(e => e.source === 'banner').length,
          footer: events.filter(e => e.source === 'footer').length,
          homepage: events.filter(e => e.source === 'homepage').length,
        },
        byDevice: {
          mobile: events.filter(e => e.device_type === 'mobile').length,
          desktop: events.filter(e => e.device_type === 'desktop').length,
        },
      };
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (settings && !form) {
      setForm(settings);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<PwaSettings>) => {
      const { error } = await supabase
        .from('pwa_install_settings' as any)
        .update({ ...data, updated_at: new Date().toISOString() } as any)
        .eq('id', (settings as any)?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pwa-install-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pwa-settings'] });
      toast.success('Configurações salvas!');
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  const handleSave = () => {
    if (!form) return;
    const { id, created_at, updated_at, ...rest } = form as any;
    saveMutation.mutate(rest);
  };

  const set = (key: keyof PwaSettings, value: any) => {
    setForm(prev => prev ? { ...prev, [key]: value } : null);
  };

  if (isLoading || !form) {
    return (
      <AdminLayout>
        <div className="space-y-3 max-w-md mx-auto py-12">
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </div>
      </AdminLayout>
    );
  }

  const conversionRate = stats && stats.totalImpressions > 0
    ? ((stats.totalInstalls / stats.totalImpressions) * 100).toFixed(1)
    : '0.0';

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Smartphone className="h-6 w-6 text-accent" />
              Instalar App (PWA)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie os pontos de instalação do aplicativo
            </p>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {saveMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-info" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.totalImpressions}</p>
                    <p className="text-xs text-muted-foreground">Impressões</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <MousePointerClick className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.totalClicks}</p>
                    <p className="text-xs text-muted-foreground">Cliques no CTA</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.totalInstalls}</p>
                    <p className="text-xs text-muted-foreground">Instalações</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-warning" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{conversionRate}%</p>
                    <p className="text-xs text-muted-foreground">Taxa de conversão</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Master Toggle + Points */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" /> Controle Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Sistema de instalação ativo</Label>
                <Switch checked={form.enabled} onCheckedChange={v => set('enabled', v)} />
              </div>
              <Separator />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pontos de Exibição</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Banner flutuante</Label>
                  <Switch checked={form.show_floating_banner} onCheckedChange={v => set('show_floating_banner', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Seção na homepage</Label>
                  <Switch checked={form.show_homepage_section} onCheckedChange={v => set('show_homepage_section', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Botão no rodapé</Label>
                  <Switch checked={form.show_in_footer} onCheckedChange={v => set('show_in_footer', v)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Targeting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Monitor className="h-4 w-4" /> Segmentação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Mostrar para visitantes</Label>
                <Switch checked={form.show_for_visitors} onCheckedChange={v => set('show_for_visitors', v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Mostrar para logados</Label>
                <Switch checked={form.show_for_logged_in} onCheckedChange={v => set('show_for_logged_in', v)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-sm">Mostrar no mobile</Label>
                <Switch checked={form.show_on_mobile} onCheckedChange={v => set('show_on_mobile', v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Mostrar no desktop</Label>
                <Switch checked={form.show_on_desktop} onCheckedChange={v => set('show_on_desktop', v)} />
              </div>
            </CardContent>
          </Card>

          {/* Texts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" /> Textos
              </CardTitle>
              <CardDescription>Personalize os textos de cada ponto de instalação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Título do banner</Label>
                <Input value={form.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Subtítulo do banner</Label>
                <Input value={form.subtitle} onChange={e => set('subtitle', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Texto do botão (CTA)</Label>
                <Input value={form.cta_text} onChange={e => set('cta_text', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Texto "dispensar"</Label>
                <Input value={form.dismiss_text} onChange={e => set('dismiss_text', e.target.value)} />
              </div>
              <Separator />
              <div>
                <Label className="text-xs">Título da seção homepage</Label>
                <Input value={form.homepage_section_title} onChange={e => set('homepage_section_title', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Subtítulo da seção homepage</Label>
                <Textarea value={form.homepage_section_subtitle} onChange={e => set('homepage_section_subtitle', e.target.value)} rows={2} />
              </div>
              <div>
                <Label className="text-xs">CTA da seção homepage</Label>
                <Input value={form.homepage_section_cta} onChange={e => set('homepage_section_cta', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">CTA do rodapé</Label>
                <Input value={form.footer_cta_text} onChange={e => set('footer_cta_text', e.target.value)} />
              </div>
              <Separator />
              <div>
                <Label className="text-xs">Instrução para iOS</Label>
                <Textarea value={form.ios_instruction} onChange={e => set('ios_instruction', e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* Timing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" /> Comportamento
              </CardTitle>
              <CardDescription>Controle quando e com que frequência exibir</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Delay para aparecer (segundos)</Label>
                <Input type="number" min={0} max={60} value={form.show_delay_seconds} onChange={e => set('show_delay_seconds', Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Visitas mínimas para exibir</Label>
                <Input type="number" min={1} max={10} value={form.min_visits} onChange={e => set('min_visits', Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Dias de pausa após dispensar</Label>
                <Input type="number" min={1} max={90} value={form.dismiss_cooldown_days} onChange={e => set('dismiss_cooldown_days', Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Máximo de impressões (0 = ilimitado)</Label>
                <Input type="number" min={0} value={form.max_impressions} onChange={e => set('max_impressions', Number(e.target.value))} />
              </div>
              <Separator />
              <div>
                <Label className="text-xs">Tipo de animação</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.animation_type}
                  onChange={e => set('animation_type', e.target.value)}
                >
                  <option value="slide-up">Slide Up</option>
                  <option value="fade">Fade</option>
                  <option value="scale">Scale</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Duração da animação (ms)</Label>
                <Input type="number" min={100} max={1000} value={form.animation_duration} onChange={e => set('animation_duration', Number(e.target.value))} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats detail */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" /> Detalhamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Por Origem</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Banner flutuante</span>
                      <Badge variant="secondary">{stats.bySource.banner}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Seção homepage</span>
                      <Badge variant="secondary">{stats.bySource.homepage}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Rodapé</span>
                      <Badge variant="secondary">{stats.bySource.footer}</Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Por Dispositivo</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Mobile</span>
                      <Badge variant="secondary">{stats.byDevice.mobile}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Desktop</span>
                      <Badge variant="secondary">{stats.byDevice.desktop}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPwaPage;
