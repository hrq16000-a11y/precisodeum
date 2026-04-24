import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Eye, FileText, Image as ImageIcon, Loader2, ShieldCheck, History, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  companyName?: string | null;
}

interface LeadRow {
  id: string;
  company_name: string | null;
  cnpj_document_url: string | null;
  banner_url: string | null;
  checklist_confirmed: boolean;
  docs_status: string | null;
  docs_submitted_at: string | null;
  docs_reviewed_at?: string | null;
  docs_review_notes?: string | null;
}

interface HistoryItem {
  id: string;
  doc_type: string;
  action: string;
  status: string | null;
  reason: string | null;
  created_at: string;
  performed_by: string | null;
}

export default function SponsorLeadDocsPanel({ open, onOpenChange, leadId, companyName }: Props) {
  const [loading, setLoading] = useState(false);
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const reload = () => {
    if (!leadId) return;
    setLoading(true);
    Promise.all([
      supabase.from('sponsor_leads' as any).select('id, company_name, cnpj_document_url, banner_url, checklist_confirmed, docs_status, docs_submitted_at, docs_reviewed_at, docs_review_notes').eq('id', leadId).maybeSingle(),
      supabase.from('sponsor_docs_history' as any).select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
    ]).then(([{ data: l }, { data: h }]) => {
      setLead(l as any);
      setHistory((h || []) as any);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!open || !leadId) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId]);

  const handleReview = async (decision: 'approved' | 'rejected', reason?: string) => {
    if (!leadId) return;
    setReviewing(true);
    try {
      const { error } = await supabase.rpc('admin_review_sponsor_docs' as any, {
        _lead_id: leadId,
        _decision: decision,
        _reason: reason ?? null,
      });
      if (error) throw error;
      toast.success(decision === 'approved' ? 'Documentação aprovada.' : 'Documentação rejeitada — patrocinador notificado.');
      setRejectOpen(false);
      setRejectReason('');
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível registrar a revisão.');
    } finally {
      setReviewing(false);
    }
  };

  const openSigned = async (path: string | null, kind: 'cnpj' | 'banner', mode: 'view' | 'download') => {
    if (!path || !leadId) return;
    setBusyKind(`${kind}-${mode}`);
    try {
      const { data, error } = await supabase.storage
        .from('sponsor_assets')
        .createSignedUrl(path, 60 * 5, mode === 'download' ? { download: true } : undefined);
      if (error) throw error;
      // audit
      await supabase.rpc('admin_log_sponsor_doc_access', { _lead_id: leadId, _doc_type: kind, _path: path });
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível gerar o link seguro.');
    } finally {
      setBusyKind(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Documentos do patrocinador
          </DialogTitle>
          <DialogDescription>
            {companyName || lead?.company_name || 'Cadastro selecionado'} — todos os acessos são registrados em auditoria.
          </DialogDescription>
        </DialogHeader>

        {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>}

        {!loading && lead && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline">{lead.docs_status || 'pending'}</Badge>
              {lead.checklist_confirmed && <Badge className="bg-emerald-100 text-emerald-800">Checklist confirmado</Badge>}
              {lead.docs_submitted_at && (
                <span className="text-muted-foreground">enviado {format(new Date(lead.docs_submitted_at), 'dd/MM/yyyy HH:mm')}</span>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <DocCard
                icon={FileText}
                label="Comprovante de CNPJ"
                path={lead.cnpj_document_url}
                onView={() => openSigned(lead.cnpj_document_url, 'cnpj', 'view')}
                onDownload={() => openSigned(lead.cnpj_document_url, 'cnpj', 'download')}
                busyView={busyKind === 'cnpj-view'}
                busyDownload={busyKind === 'cnpj-download'}
              />
              <DocCard
                icon={ImageIcon}
                label="Banner do anúncio"
                path={lead.banner_url}
                onView={() => openSigned(lead.banner_url, 'banner', 'view')}
                onDownload={() => openSigned(lead.banner_url, 'banner', 'download')}
                busyView={busyKind === 'banner-view'}
                busyDownload={busyKind === 'banner-download'}
              />
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="flex items-center gap-2 text-sm font-semibold mb-2">
                <History className="h-4 w-4" /> Histórico de eventos ({history.length})
              </p>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
              ) : (
                <ul className="space-y-1.5 max-h-72 overflow-auto">
                  {history.map((h) => (
                    <li key={h.id} className="text-xs flex items-start justify-between gap-2 border-b border-border/50 pb-1.5">
                      <div>
                        <p className="font-medium text-foreground">{h.action} · {h.doc_type}</p>
                        {h.reason && <p className="text-muted-foreground">{h.reason}</p>}
                      </div>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(h.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lead.docs_review_notes && (lead.docs_status === 'approved' || lead.docs_status === 'rejected') && (
              <div className={`rounded-lg border p-3 text-xs ${lead.docs_status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
                <p className="font-semibold mb-1">
                  {lead.docs_status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                  {lead.docs_reviewed_at && ` · ${format(new Date(lead.docs_reviewed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`}
                </p>
                <p>{lead.docs_review_notes}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <Button
                size="sm"
                className="flex-1 min-w-[140px] bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={reviewing || lead.docs_status === 'approved' || (!lead.cnpj_document_url && !lead.banner_url)}
                onClick={() => handleReview('approved')}
              >
                {reviewing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Aprovar documentação
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 min-w-[140px]"
                disabled={reviewing || lead.docs_status === 'rejected'}
                onClick={() => setRejectOpen(true)}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Rejeitar / Solicitar correção
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <Dialog open={rejectOpen} onOpenChange={(o) => { if (!reviewing) { setRejectOpen(o); if (!o) setRejectReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" /> Rejeitar documentação
            </DialogTitle>
            <DialogDescription>
              Descreva o motivo. O patrocinador será notificado e o checklist será reaberto para correção.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ex: O CNPJ está ilegível. Reenviar uma foto nítida do cartão CNPJ atualizado."
            rows={5}
            maxLength={500}
            disabled={reviewing}
          />
          <p className="text-xs text-muted-foreground">{rejectReason.trim().length}/500 — mínimo 5 caracteres.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={reviewing}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={reviewing || rejectReason.trim().length < 5}
              onClick={() => handleReview('rejected', rejectReason.trim())}
            >
              {reviewing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function DocCard({ icon: Icon, label, path, onView, onDownload, busyView, busyDownload }: any) {
  const exists = !!path;
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold">{label}</p>
      </div>
      {!exists ? (
        <p className="text-xs text-muted-foreground">Não enviado.</p>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onView} disabled={busyView}>
            {busyView ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1" />} Ver
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={onDownload} disabled={busyDownload}>
            {busyDownload ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />} Baixar
          </Button>
        </div>
      )}
    </div>
  );
}
