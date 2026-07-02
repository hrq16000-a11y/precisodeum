import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollText, Search, Download, Loader2, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoryRow {
  id: string;
  lead_id: string;
  company_name: string | null;
  email: string | null;
  current_status: string | null;
  doc_type: string;
  action: string;
  status: string | null;
  reason: string | null;
  performed_by: string | null;
  metadata: any;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  reopened: 'bg-amber-100 text-amber-800',
  uploaded: 'bg-blue-100 text-blue-800',
  replaced: 'bg-blue-100 text-blue-800',
  validation_failed: 'bg-red-100 text-red-800',
  checklist_confirmed: 'bg-purple-100 text-purple-800',
  reviewed: 'bg-slate-100 text-slate-800',
};

const ACTION_LABEL: Record<string, string> = {
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  reopened: 'Checklist reaberto',
  uploaded: 'Documento enviado',
  replaced: 'Documento substituído',
  validation_failed: 'Falha de validação',
  checklist_confirmed: 'Checklist confirmado',
  reviewed: 'Acessado',
};

const TYPE_LABEL: Record<string, string> = {
  cnpj: 'CNPJ',
  banner: 'Banner',
  checklist: 'Checklist',
  review: 'Revisão',
  additional: 'Adicional',
};

export default function AdminSponsorDocsHistoryPage() {
  const { isAdmin, loading } = useAdmin();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: rows = [], isLoading } = useQuery<HistoryRow[]>({
    queryKey: ['admin-sponsor-docs-history'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_sponsor_docs_history_view' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (actionFilter !== 'all' && r.action !== actionFilter) return false;
      if (typeFilter !== 'all' && r.doc_type !== typeFilter) return false;
      if (q) {
        const hay = `${r.company_name || ''} ${r.email || ''} ${r.reason || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, actionFilter, typeFilter]);

  const stats = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => { map[r.action] = (map[r.action] || 0) + 1; });
    return map;
  }, [rows]);

  const exportCsv = () => {
    const header = 'Data,Empresa,Email,Tipo,Ação,Status,Motivo';
    const lines = filtered.map((r) =>
      [
        format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
        `"${(r.company_name || '').replace(/"/g, '""')}"`,
        `"${r.email || ''}"`,
        TYPE_LABEL[r.doc_type] || r.doc_type,
        ACTION_LABEL[r.action] || r.action,
        r.status || '',
        `"${(r.reason || '').replace(/"/g, '""')}"`,
      ].join(',')
    );
    const blob = new Blob(['\ufeff' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico-docs-patrocinadores_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded bg-muted" /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6 text-primary" /> Histórico de Documentos
            </h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} evento(s) de revisão e movimentação de documentos de patrocinadores.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {Object.entries(stats).map(([action, count]) => (
            <Card key={action} className="p-0">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{count}</p>
                <Badge className={`text-[10px] mt-1 ${ACTION_COLORS[action] || ''}`}>
                  {ACTION_LABEL[action] || action}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa, email, motivo..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Ação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {Object.entries(ACTION_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Data/Hora</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Motivo / Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando...
                </TableCell></TableRow>
              )}
              {!isLoading && filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                    {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{r.company_name || '—'}</p>
                    <p className="text-[11px] text-muted-foreground">{r.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[r.doc_type] || r.doc_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${ACTION_COLORS[r.action] || ''}`}>
                      {ACTION_LABEL[r.action] || r.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-md">
                    {r.reason ? <span className="text-foreground">{r.reason}</span> : <span className="text-muted-foreground">—</span>}
                    {r.metadata?.pending_items && Array.isArray(r.metadata.pending_items) && r.metadata.pending_items.length > 0 && (
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Itens: {r.metadata.pending_items.join('; ')}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhum evento encontrado.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
