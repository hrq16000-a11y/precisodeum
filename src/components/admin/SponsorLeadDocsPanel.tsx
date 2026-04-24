import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Eye, FileText, Image as ImageIcon, Loader2, ShieldCheck, History } from 'lucide-react';
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

  useEffect(() => {
    if (!open || !leadId) return;
    setLoading(true);
    Promise.all([
      supabase.from('sponsor_leads' as any).select('id, company_name, cnpj_document_url, banner_url, checklist_confirmed, docs_status, docs_submitted_at').eq('id', leadId).maybeSingle(),
      supabase.from('sponsor_docs_history' as any).select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
    ]).then(([{ data: l }, { data: h }]) => {
      setLead(l as any);
      setHistory((h || []) as any);
      setLoading(false);
    });
  }, [open, leadId]);

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
          </div>
        )}
      </DialogContent>
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
