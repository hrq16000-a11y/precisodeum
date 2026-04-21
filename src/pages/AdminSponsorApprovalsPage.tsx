import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CheckCircle2, XCircle, ExternalLink, MapPin, Building2, Calendar, ShieldCheck,
  ShieldAlert, MousePointerClick, Eye, Hash, Megaphone, FileX2, Sparkles, Image as ImageIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { isValidCpfCnpj } from '@/lib/cpfCnpj';
import { logAuditAction } from '@/hooks/useAuditLog';
import { POSITION_CONFIG } from '@/config/sponsorPositions';

type SponsorRow = {
  id: string;
  title: string | null;
  company_name: string | null;
  image_url: string | null;
  logo_url: string | null;
  link_url: string | null;
  external_link: string | null;
  position: string | null;
  cnpj: string | null;
  email: string | null;
  user_ref: string | null;
  user_id: string | null;
  linked_city: string | null;
  status: string;
  plan: string | null;
  created_at: string;
  start_date: string | null;
  end_date: string | null;
  rejection_reason: string | null;
  impressions: number | null;
  clicks: number | null;
};

const STATUS_TABS = [
  { value: 'pending_approval', label: 'Pendentes', icon: ShieldAlert, accent: 'text-amber-500' },
  { value: 'active', label: 'Ativos', icon: ShieldCheck, accent: 'text-emerald-500' },
  { value: 'rejected', label: 'Arquivados', icon: FileX2, accent: 'text-red-500' },
] as const;

function aspectFromDimensions(dim?: string): string {
  // e.g. "1600×200 px (8:1)" → "8 / 1"
  const m = dim?.match(/\((\d+)\s*:\s*(\d+)\)/);
  if (m) return `${m[1]} / ${m[2]}`;
  const px = dim?.match(/(\d+)\s*[×x]\s*(\d+)/);
  if (px) return `${px[1]} / ${px[2]}`;
  return '8 / 1';
}

/* ─── Visual Mockup of the slot ─── */
function SlotMockup({ sponsor }: { sponsor: SponsorRow }) {
  const cfg = sponsor.position ? POSITION_CONFIG[sponsor.position] : undefined;
  const ratio = aspectFromDimensions(cfg?.dimensions);
  const Icon = cfg?.icon || Megaphone;
  const img = sponsor.image_url || sponsor.logo_url;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Icon className={cn('h-3.5 w-3.5', cfg?.color || 'text-primary')} />
          {cfg?.label || sponsor.position || 'Slot indefinido'}
        </span>
        <span className="font-mono text-[10px]">{cfg?.dimensions || '—'}</span>
      </div>

      <div
        className="relative overflow-hidden rounded-lg border border-dashed border-border bg-muted/40"
        style={{ aspectRatio: ratio }}
      >
        {img ? (
          <img
            src={img}
            alt={sponsor.title || 'Preview'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs">Sem imagem enviada</span>
          </div>
        )}
        <div className="absolute left-2 top-2 rounded-md bg-background/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur">
          Preview
        </div>
      </div>
    </div>
  );
}

/* ─── Pending review card ─── */
function PendingCard({
  sponsor,
  onApprove,
  onReject,
}: {
  sponsor: SponsorRow;
  onApprove: (s: SponsorRow) => void;
  onReject: (s: SponsorRow) => void;
}) {
  const cnpjValid = sponsor.cnpj ? isValidCpfCnpj(sponsor.cnpj) : null;
  const targetUrl = sponsor.link_url || sponsor.external_link;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="space-y-4 p-4">
        <SlotMockup sponsor={sponsor} />

        <div className="space-y-1.5">
          <h3 className="line-clamp-1 text-sm font-bold text-foreground">
            {sponsor.title || sponsor.company_name || 'Sem título'}
          </h3>
          {sponsor.company_name && sponsor.title && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" /> {sponsor.company_name}
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-[11px]">
          <div className="col-span-2 flex items-start gap-1.5">
            <Hash className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="font-mono text-muted-foreground">{sponsor.user_ref || '—'}</span>
          </div>

          {sponsor.linked_city && (
            <div className="col-span-2 flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-foreground">{sponsor.linked_city}</span>
            </div>
          )}

          <div className="col-span-2 flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              Enviado em {format(new Date(sponsor.created_at), 'dd/MM/yyyy HH:mm')}
            </span>
          </div>

          {sponsor.cnpj && (
            <div className="col-span-2 flex items-center justify-between gap-1.5">
              <span className="font-mono text-muted-foreground">CNPJ: {sponsor.cnpj}</span>
              {cnpjValid === true && (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                  Mod11 OK
                </Badge>
              )}
              {cnpjValid === false && (
                <Badge variant="outline" className="border-red-500/40 text-red-600">
                  Mod11 inválido
                </Badge>
              )}
            </div>
          )}
        </dl>

        {targetUrl && (
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={targetUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> Testar link de destino
            </a>
          </Button>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => onApprove(sponsor)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            size="sm"
          >
            <CheckCircle2 className="h-4 w-4" /> Aprovar
          </Button>
          <Button onClick={() => onReject(sponsor)} variant="destructive" size="sm" className="flex-1">
            <XCircle className="h-4 w-4" /> Rejeitar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main page ─── */
export default function AdminSponsorApprovalsPage() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<typeof STATUS_TABS[number]['value']>('pending_approval');
  const [rejectTarget, setRejectTarget] = useState<SponsorRow | null>(null);
  const [reason, setReason] = useState('');

  const { data: sponsors = [], isLoading } = useQuery({
    queryKey: ['admin-sponsor-approvals', tab],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sponsors')
        .select(
          'id,title,company_name,image_url,logo_url,link_url,external_link,position,cnpj,email,user_ref,user_id,linked_city,status,plan,created_at,start_date,end_date,rejection_reason,impressions,clicks'
        )
        .eq('status', tab)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as SponsorRow[];
    },
  });

  // Aggregated metrics for the "active" tab
  const activeIds = useMemo(
    () => (tab === 'active' ? sponsors.map(s => s.id) : []),
    [tab, sponsors]
  );
  const { data: metricsMap = {} } = useQuery({
    queryKey: ['admin-sponsor-metrics-summary', activeIds],
    enabled: activeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('admin_sponsor_metrics_summary', {
        _sponsor_ids: activeIds,
      });
      if (error || !data) return {};
      const map: Record<string, { impressions: number; clicks: number }> = {};
      (data as any[]).forEach(r => {
        map[r.sponsor_id] = {
          impressions: Number(r.total_impressions || 0),
          clicks: Number(r.total_clicks || 0),
        };
      });
      return map;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (s: SponsorRow) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from('sponsors')
        .update({
          status: 'active',
          active: true,
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
          start_date: s.start_date || today,
        })
        .eq('id', s.id);
      if (error) throw error;
      await logAuditAction('sponsor_approved', 'sponsor', s.id, {
        sponsor_user_ref: s.user_ref,
        admin_user_ref: profile?.user_ref,
        position: s.position,
      });
    },
    onSuccess: () => {
      toast({ title: 'Patrocinador aprovado', description: 'Anúncio liberado para exibição.' });
      qc.invalidateQueries({ queryKey: ['admin-sponsor-approvals'] });
    },
    onError: (e: any) =>
      toast({ title: 'Erro ao aprovar', description: e.message, variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ s, motive }: { s: SponsorRow; motive: string }) => {
      const { error } = await supabase
        .from('sponsors')
        .update({
          status: 'rejected',
          active: false,
          rejection_reason: motive,
          rejected_by: profile?.id,
          rejected_at: new Date().toISOString(),
        })
        .eq('id', s.id);
      if (error) throw error;
      await logAuditAction('sponsor_rejected', 'sponsor', s.id, {
        sponsor_user_ref: s.user_ref,
        admin_user_ref: profile?.user_ref,
        reason: motive,
      });
    },
    onSuccess: () => {
      toast({ title: 'Patrocinador rejeitado', description: 'Motivo registrado em auditoria.' });
      setRejectTarget(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['admin-sponsor-approvals'] });
    },
    onError: (e: any) =>
      toast({ title: 'Erro ao rejeitar', description: e.message, variant: 'destructive' }),
  });

  const handleReject = () => {
    if (!rejectTarget || !reason.trim()) {
      toast({ title: 'Informe o motivo', variant: 'destructive' });
      return;
    }
    rejectMutation.mutate({ s: rejectTarget, motive: reason.trim() });
  };

  if (adminLoading) {
    return (
      <AdminLayout>
        <div className="space-y-3 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="p-6 text-center text-muted-foreground">Acesso restrito a administradores.</div>
      </AdminLayout>
    );
  }

  const counts = sponsors.length;

  return (
    <AdminLayout>
      <TooltipProvider>
        <div className="space-y-5 p-4 sm:p-6">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
                <Sparkles className="h-6 w-6 text-primary" />
                Aprovação de Patrocinadores
              </h1>
              <p className="text-sm text-muted-foreground">
                Revise visualmente cada anúncio antes de liberar para exibição pública.
              </p>
            </div>
          </header>

          <Tabs value={tab} onValueChange={v => setTab(v as any)} className="space-y-4">
            <TabsList>
              {STATUS_TABS.map(t => {
                const Icon = t.icon;
                return (
                  <TabsTrigger key={t.value} value={t.value} className="gap-2">
                    <Icon className={cn('h-4 w-4', t.accent)} />
                    {t.label}
                    {tab === t.value && (
                      <Badge variant="secondary" className="ml-1">
                        {counts}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* PENDING — Grid of visual cards */}
            <TabsContent value="pending_approval" className="space-y-4">
              {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-96 w-full" />
                  ))}
                </div>
              ) : sponsors.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                    <ShieldCheck className="h-10 w-10 text-emerald-500" />
                    <p className="text-sm font-medium">Nenhum patrocinador aguardando aprovação</p>
                    <p className="text-xs text-muted-foreground">Tudo em dia. Bom trabalho!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sponsors.map(s => (
                    <PendingCard
                      key={s.id}
                      sponsor={s}
                      onApprove={() => approveMutation.mutate(s)}
                      onReject={() => {
                        setRejectTarget(s);
                        setReason('');
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ACTIVE — DataTable with metrics */}
            <TabsContent value="active">
              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-6">
                      <Skeleton className="h-48 w-full" />
                    </div>
                  ) : sponsors.length === 0 ? (
                    <div className="p-12 text-center text-sm text-muted-foreground">
                      Nenhum patrocinador ativo.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Anúncio</TableHead>
                          <TableHead>Slot</TableHead>
                          <TableHead>Cidade</TableHead>
                          <TableHead className="text-right">Impressões</TableHead>
                          <TableHead className="text-right">Cliques</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sponsors.map(s => {
                          const m = metricsMap[s.id] || {
                            impressions: s.impressions || 0,
                            clicks: s.clicks || 0,
                          };
                          const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
                          const cfg = s.position ? POSITION_CONFIG[s.position] : undefined;
                          return (
                            <TableRow key={s.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {(s.image_url || s.logo_url) && (
                                    <img
                                      src={s.image_url || s.logo_url || ''}
                                      alt=""
                                      className="h-9 w-14 rounded object-cover"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">
                                      {s.title || s.company_name}
                                    </p>
                                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                                      {s.user_ref}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-normal">
                                  {cfg?.label || s.position || '—'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{s.linked_city || '—'}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                <span className="inline-flex items-center gap-1">
                                  <Eye className="h-3 w-3 text-muted-foreground" />
                                  {m.impressions.toLocaleString('pt-BR')}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                <span className="inline-flex items-center gap-1">
                                  <MousePointerClick className="h-3 w-3 text-muted-foreground" />
                                  {m.clicks.toLocaleString('pt-BR')}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                {ctr.toFixed(2)}%
                              </TableCell>
                              <TableCell className="text-right">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setRejectTarget(s);
                                        setReason('');
                                      }}
                                    >
                                      <XCircle className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Arquivar / Rejeitar</TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* REJECTED */}
            <TabsContent value="rejected">
              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-6">
                      <Skeleton className="h-48 w-full" />
                    </div>
                  ) : sponsors.length === 0 ? (
                    <div className="p-12 text-center text-sm text-muted-foreground">
                      Nenhum patrocinador arquivado.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Anúncio</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Slot</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sponsors.map(s => (
                          <TableRow key={s.id}>
                            <TableCell>
                              <p className="text-sm font-medium">{s.title || s.company_name}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">{s.user_ref}</p>
                            </TableCell>
                            <TableCell className="max-w-md">
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {s.rejection_reason || '—'}
                              </p>
                            </TableCell>
                            <TableCell className="text-sm">{s.position || '—'}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveMutation.mutate(s)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                Reativar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Rejection modal */}
          <Dialog open={!!rejectTarget} onOpenChange={o => !o && setRejectTarget(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  Rejeitar patrocinador
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Anúncio: <strong>{rejectTarget?.title || rejectTarget?.company_name}</strong>
                </p>
                <Textarea
                  autoFocus
                  placeholder="Ex: Imagem com baixa resolução, link quebrado, conteúdo fora das diretrizes..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={4}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectTarget(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={rejectMutation.isPending || !reason.trim()}
                >
                  Confirmar rejeição
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </AdminLayout>
  );
}
