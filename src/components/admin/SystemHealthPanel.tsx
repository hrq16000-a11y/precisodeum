import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Activity, MapPin, FileText, ImageIcon, Bell, Loader2, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ProviderRow {
  id: string;
  user_id: string;
  business_name: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
}

interface HealthData {
  counts: { no_gps: number; no_cnpj: number; no_portfolio: number; total: number };
  no_gps: ProviderRow[];
  no_cnpj: ProviderRow[];
  no_portfolio: ProviderRow[];
}

type Bucket = 'no_gps' | 'no_cnpj' | 'no_portfolio';

const BUCKET_META: Record<Bucket, { label: string; icon: any; color: string; defaultTitle: string; defaultMessage: string; }> = {
  no_gps: {
    label: 'Sem GPS (Lat/Lng)',
    icon: MapPin,
    color: 'text-amber-600',
    defaultTitle: 'Atualize sua localização',
    defaultMessage: 'Seu perfil ainda não tem coordenadas GPS. Atualize seu endereço no painel para aparecer em buscas por proximidade.',
  },
  no_cnpj: {
    label: 'Empresas sem CNPJ',
    icon: FileText,
    color: 'text-rose-600',
    defaultTitle: 'Cadastre seu CNPJ',
    defaultMessage: 'Adicione o CNPJ da sua empresa para fortalecer a credibilidade do seu perfil.',
  },
  no_portfolio: {
    label: 'Sem foto no portfólio',
    icon: ImageIcon,
    color: 'text-violet-600',
    defaultTitle: 'Adicione fotos ao seu portfólio',
    defaultMessage: 'Profissionais com portfólio recebem 5x mais leads. Suba pelo menos 3 fotos para começar.',
  },
};

const SystemHealthPanel = () => {
  const qc = useQueryClient();
  const [openBucket, setOpenBucket] = useState<Bucket | null>(null);
  const [notifyState, setNotifyState] = useState<{ bucket: Bucket; targets: string[] } | null>(null);
  const [notifyForm, setNotifyForm] = useState({ title: '', message: '', link: '' });
  const [sending, setSending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-system-health'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_system_health' as any, { _limit: 100 });
      if (error) throw error;
      return data as unknown as HealthData;
    },
    staleTime: 60_000,
  });

  const counts = data?.counts ?? { no_gps: 0, no_cnpj: 0, no_portfolio: 0, total: 0 };

  const openBucketList = (b: Bucket) => setOpenBucket(b);
  const startNotify = (bucket: Bucket, targets: string[]) => {
    const meta = BUCKET_META[bucket];
    setNotifyForm({ title: meta.defaultTitle, message: meta.defaultMessage, link: '/dashboard/perfil' });
    setNotifyState({ bucket, targets });
  };

  const sendNotify = async () => {
    if (!notifyState) return;
    if (!notifyForm.title.trim() || !notifyForm.message.trim()) {
      toast.error('Preencha título e mensagem.');
      return;
    }
    setSending(true);
    const { data: cnt, error } = await supabase.rpc('admin_notify_users' as any, {
      _user_ids: notifyState.targets,
      _title: notifyForm.title,
      _message: notifyForm.message,
      _link: notifyForm.link || null,
    });
    setSending(false);
    if (error) {
      toast.error('Erro: ' + error.message);
      return;
    }
    toast.success(`${cnt} notificação(ões) enviada(s).`);
    setNotifyState(null);
    qc.invalidateQueries({ queryKey: ['admin-system-health'] });
  };

  const bucketRows = openBucket ? (data?.[openBucket] ?? []) : [];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Saúde do Sistema
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Dados reais de prestadores aprovados ({counts.total} no total)
          </p>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(BUCKET_META) as Bucket[]).map((b) => {
          const meta = BUCKET_META[b];
          const Icon = meta.icon;
          const value = counts[b];
          const pct = counts.total > 0 ? Math.round((value / counts.total) * 100) : 0;
          const status = pct > 50 ? 'critical' : pct > 20 ? 'warn' : 'ok';
          return (
            <div key={b} className="rounded-xl border border-border/60 bg-background p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-muted ${meta.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <Badge variant={status === 'critical' ? 'destructive' : status === 'warn' ? 'secondary' : 'outline'} className="text-[10px]">
                  {status === 'ok' ? <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> : <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                  {pct}%
                </Badge>
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{meta.label}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openBucketList(b)} disabled={value === 0}>
                  Ver lista <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => startNotify(b, (data?.[b] ?? []).map((r) => r.user_id))}
                  disabled={value === 0}
                >
                  <Bell className="h-3 w-3 mr-1" /> Notificar
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* List dialog */}
      <Dialog open={openBucket !== null} onOpenChange={(o) => !o && setOpenBucket(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {openBucket && <>{BUCKET_META[openBucket].label} <Badge variant="secondary">{bucketRows.length}</Badge></>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            {bucketRows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {r.business_name || '(sem nome)'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {[r.city, r.state].filter(Boolean).join(' / ') || '—'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => openBucket && startNotify(openBucket, [r.user_id])}
                >
                  <Bell className="h-3 w-3 mr-1" /> Notificar
                </Button>
              </div>
            ))}
            {bucketRows.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Tudo limpo aqui!</p>
            )}
          </div>
          <DialogFooter>
            {openBucket && bucketRows.length > 0 && (
              <Button onClick={() => startNotify(openBucket, bucketRows.map((r) => r.user_id))}>
                <Bell className="h-4 w-4 mr-2" /> Notificar todos ({bucketRows.length})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify dialog */}
      <Dialog open={notifyState !== null} onOpenChange={(o) => !o && setNotifyState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificar {notifyState?.targets.length} usuário(s)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Título</label>
              <Input
                value={notifyForm.title}
                onChange={(e) => setNotifyForm({ ...notifyForm, title: e.target.value })}
                maxLength={120}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Mensagem</label>
              <Textarea
                value={notifyForm.message}
                onChange={(e) => setNotifyForm({ ...notifyForm, message: e.target.value })}
                rows={4}
                maxLength={500}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Link (opcional)</label>
              <Input
                value={notifyForm.link}
                onChange={(e) => setNotifyForm({ ...notifyForm, link: e.target.value })}
                placeholder="/dashboard/perfil"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyState(null)} disabled={sending}>
              Cancelar
            </Button>
            <Button onClick={sendNotify} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SystemHealthPanel;
