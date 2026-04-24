import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Clock, FileText, Image as ImageIcon, Loader2, ShieldCheck, XCircle, AlertCircle, ArrowLeft, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface HistoryItem {
  id: string;
  doc_type: string;
  action: string;
  status: string | null;
  reason: string | null;
  created_at: string;
}

interface LeadStatus {
  id: string;
  company_name: string | null;
  status: string;
  docs_status: string;
  docs_reviewed_at: string | null;
  docs_review_notes: string | null;
  has_cnpj: boolean;
  has_banner: boolean;
  checklist_confirmed: boolean;
  docs_submitted_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string; icon: any }> = {
  pending:   { label: 'Aguardando documentos', cls: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  submitted: { label: 'Enviado — em análise',    cls: 'bg-blue-100 text-blue-800 border-blue-200',     icon: ShieldCheck },
  approved:  { label: 'Aprovado',                cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  rejected:  { label: 'Rejeitado',               cls: 'bg-red-100 text-red-800 border-red-200',         icon: XCircle },
};

const ACTION_LABEL: Record<string, string> = {
  uploaded: 'Documento enviado',
  replaced: 'Documento substituído',
  validation_failed: 'Falha de validação',
  checklist_confirmed: 'Checklist confirmado',
  reviewed: 'Acessado pelo administrador',
  approved: 'Aprovado pela equipe',
  rejected: 'Rejeitado pela equipe',
};

const TYPE_LABEL: Record<string, string> = {
  cnpj: 'Comprovante de CNPJ',
  banner: 'Banner do anúncio',
  checklist: 'Checklist',
  review: 'Revisão',
  additional: 'Documento adicional',
};

export default function SponsorStatusPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const initialId = params.get('id') || '';
  const [leadId, setLeadId] = useState<string>(initialId);
  const [input, setInput] = useState<string>(initialId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadStatus | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const handleClaim = async () => {
    if (!leadId) return;
    setClaiming(true);
    try {
      const { error: cErr } = await supabase.rpc('claim_sponsor_lead' as any, { _lead_id: leadId });
      if (cErr) throw cErr;
      toast.success('Cadastro vinculado! Agora você receberá notificações sobre revisões e atualizações.');
      setClaimed(true);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível vincular este cadastro.');
    } finally {
      setClaiming(false);
    }
  };

  const load = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_sponsor_docs_status', { _lead_id: id });
      if (rpcErr) throw rpcErr;
      const payload = data as any;
      if (!payload || payload.error === 'not_found') {
        setLead(null); setHistory([]); setError('Cadastro não encontrado.');
      } else if (payload.error) {
        setError('Não foi possível carregar o status.');
      } else {
        setLead(payload.lead as LeadStatus);
        setHistory((payload.history || []) as HistoryItem[]);
      }
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leadId) load(leadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLeadId(input.trim());
    setParams({ id: input.trim() }, { replace: true });
  };

  const statusInfo = lead ? STATUS_LABEL[lead.docs_status] || STATUS_LABEL.pending : null;
  const StatusIcon = statusInfo?.icon || Clock;

  return (
    <>
      <Header />
      <main className="container max-w-3xl py-10">
        <Link to="/quero-ser-patrocinador" className="text-xs text-muted-foreground inline-flex items-center gap-1 mb-4 hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Voltar para a página do patrocinador
        </Link>
        <h1 className="text-2xl font-bold mb-1">Acompanhamento do cadastro</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Informe o ID do seu cadastro para ver se os documentos foram recebidos, revisados e aprovados.
        </p>

        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 mb-6">
          <div className="flex-1">
            <Label htmlFor="lead-id" className="text-xs">ID do cadastro</Label>
            <Input id="lead-id" value={input} onChange={(e) => setInput(e.target.value)} placeholder="ex: 4f12-..." />
          </div>
          <Button type="submit" className="sm:self-end">Consultar</Button>
        </form>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando status...</div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {lead && statusInfo && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="truncate">{lead.company_name || 'Cadastro de patrocinador'}</span>
                <Badge variant="outline" className={`gap-1 ${statusInfo.cls}`}>
                  <StatusIcon className="h-3 w-3" /> {statusInfo.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Tile icon={FileText} label="Comprovante de CNPJ" ok={lead.has_cnpj} />
                <Tile icon={ImageIcon} label="Banner do anúncio" ok={lead.has_banner} />
                <Tile icon={CheckCircle2} label="Checklist confirmado" ok={lead.checklist_confirmed} />
              </div>
              {lead.docs_submitted_at && (
                <p className="text-xs text-muted-foreground">
                  Documentos enviados em {format(new Date(lead.docs_submitted_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}.
                </p>
              )}
              {lead.docs_reviewed_at && (
                <p className="text-xs text-muted-foreground">
                  Revisado em {format(new Date(lead.docs_reviewed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}.
                  {lead.docs_review_notes ? <> — “{lead.docs_review_notes}”</> : null}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {lead && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</p>
              ) : (
                <ol className="relative border-l border-border ml-2 space-y-3">
                  {history.map((h) => (
                    <li key={h.id} className="ml-4">
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary"></span>
                      <p className="text-sm font-medium text-foreground">
                        {ACTION_LABEL[h.action] || h.action} — {TYPE_LABEL[h.doc_type] || h.doc_type}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {h.reason ? <> · {h.reason}</> : null}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </>
  );
}

function Tile({ icon: Icon, label, ok }: { icon: any; label: string; ok: boolean }) {
  return (
    <div className={`rounded-lg border p-3 flex items-center gap-2 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-muted/30'}`}>
      <Icon className={`h-4 w-4 ${ok ? 'text-emerald-600' : 'text-muted-foreground'}`} />
      <div>
        <p className="text-xs font-medium">{label}</p>
        <p className={`text-[11px] ${ok ? 'text-emerald-700' : 'text-muted-foreground'}`}>{ok ? 'Recebido' : 'Pendente'}</p>
      </div>
    </div>
  );
}
