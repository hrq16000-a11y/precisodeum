import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText, Image as ImageIcon, ShieldCheck, AlertTriangle, CheckCircle2,
  XCircle, RefreshCw, ChevronDown, ChevronUp, History,
} from 'lucide-react';

export interface AuditEntry {
  id: string;
  doc_type: string;            // cnpj | banner | checklist | review | additional
  action: string;              // uploaded | replaced | validation_failed | checklist_confirmed | reviewed | approved | rejected
  status: string | null;
  reason: string | null;
  created_at: string;
  reviewer_name?: string | null;
  metadata?: Record<string, any> | null;
}

interface Props {
  history: AuditEntry[];
  currentCnpjUrl?: string | null;
  currentBannerUrl?: string | null;
}

const ACTION_META: Record<string, { label: string; icon: any; cls: string }> = {
  uploaded:            { label: 'Documento enviado',         icon: FileText,     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  replaced:            { label: 'Documento substituído',     icon: RefreshCw,    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  validation_failed:   { label: 'Falha de validação',        icon: AlertTriangle,cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  checklist_confirmed: { label: 'Checklist confirmado',      icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  reviewed:            { label: 'Acessado pelo administrador', icon: ShieldCheck, cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  approved:            { label: 'Aprovado pela equipe',      icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected:            { label: 'Rejeitado pela equipe',     icon: XCircle,      cls: 'bg-red-50 text-red-700 border-red-200' },
  reopened:            { label: 'Checklist reaberto',         icon: RefreshCw,    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const TYPE_META: Record<string, { label: string; icon: any }> = {
  cnpj:       { label: 'CNPJ',         icon: FileText },
  banner:     { label: 'Banner',       icon: ImageIcon },
  checklist:  { label: 'Checklist',    icon: CheckCircle2 },
  review:     { label: 'Revisão',      icon: ShieldCheck },
  additional: { label: 'Adicional',    icon: FileText },
};

/**
 * Auditoria detalhada para o patrocinador: agrupa eventos por tipo (cnpj/banner/checklist/review),
 * destaca trocas de URL (uploaded -> replaced), mostra metadata (tamanho/tipo) e quem revisou.
 */
const SponsorDocsAuditTrail = ({ history, currentCnpjUrl, currentBannerUrl }: Props) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  const grouped = useMemo(() => {
    const sorted = [...history].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    const visible = showAll ? sorted : sorted.slice(0, 8);
    return visible;
  }, [history, showAll]);

  const versions = useMemo(() => {
    const cnpjVersions = history.filter(h => h.doc_type === 'cnpj' && (h.action === 'uploaded' || h.action === 'replaced')).length;
    const bannerVersions = history.filter(h => h.doc_type === 'banner' && (h.action === 'uploaded' || h.action === 'replaced')).length;
    return { cnpjVersions, bannerVersions };
  }, [history]);

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Auditoria detalhada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" /> Auditoria detalhada
          </span>
          <div className="flex gap-1">
            <Badge variant="outline" className="text-[10px] gap-1">
              <FileText className="h-3 w-3" /> {versions.cnpjVersions} versão(ões) CNPJ
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <ImageIcon className="h-3 w-3" /> {versions.bannerVersions} versão(ões) banner
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {grouped.map((entry) => {
          const meta = ACTION_META[entry.action] || { label: entry.action, icon: FileText, cls: 'bg-muted text-muted-foreground border-border' };
          const typeMeta = TYPE_META[entry.doc_type] || { label: entry.doc_type, icon: FileText };
          const ActionIcon = meta.icon;
          const isOpen = expanded[entry.id];
          const hasDetails = !!(entry.reason || entry.metadata);

          return (
            <div key={entry.id} className={`rounded-lg border p-3 ${meta.cls}`}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-2 text-left"
                onClick={() => hasDetails && setExpanded((e) => ({ ...e, [entry.id]: !isOpen }))}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <ActionIcon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">
                      {meta.label} <span className="opacity-70">— {typeMeta.label}</span>
                    </p>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      {entry.reviewer_name ? <> · por <strong>{entry.reviewer_name}</strong></> : null}
                    </p>
                  </div>
                </div>
                {hasDetails && (isOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />)}
              </button>

              {isOpen && (
                <div className="mt-2 ml-6 space-y-1 text-[11px] opacity-90">
                  {entry.reason && (
                    <p><span className="font-medium">Motivo/observação:</span> {entry.reason}</p>
                  )}
                  {entry.metadata?.file_name && (
                    <p><span className="font-medium">Arquivo:</span> {entry.metadata.file_name}</p>
                  )}
                  {entry.metadata?.file_size != null && (
                    <p>
                      <span className="font-medium">Tamanho:</span>{' '}
                      {(Number(entry.metadata.file_size) / 1024).toFixed(1)} KB
                    </p>
                  )}
                  {entry.metadata?.file_type && (
                    <p><span className="font-medium">Tipo:</span> {entry.metadata.file_type}</p>
                  )}
                  {entry.metadata?.previous_url && (
                    <p className="break-all">
                      <span className="font-medium">URL anterior:</span> <code>{entry.metadata.previous_url}</code>
                    </p>
                  )}
                  {entry.metadata?.new_url && (
                    <p className="break-all">
                      <span className="font-medium">URL atual:</span> <code>{entry.metadata.new_url}</code>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {history.length > 8 && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Mostrar menos' : `Ver todos os ${history.length} eventos`}
          </Button>
        )}

        <div className="mt-4 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-md border border-border p-2">
            <p className="font-medium flex items-center gap-1"><FileText className="h-3 w-3" /> CNPJ atual</p>
            <p className="text-muted-foreground break-all mt-0.5">
              {currentCnpjUrl ? <code>{currentCnpjUrl.split('/').pop()}</code> : '— não enviado'}
            </p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="font-medium flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Banner atual</p>
            <p className="text-muted-foreground break-all mt-0.5">
              {currentBannerUrl ? <code>{currentBannerUrl.split('/').pop()}</code> : '— não enviado'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SponsorDocsAuditTrail;
