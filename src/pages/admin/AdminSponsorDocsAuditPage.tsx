/**
 * /admin/sponsor-docs-audit — Trilha de auditoria das RPCs seguras
 * `attach_sponsor_lead_docs` e `accept_sponsor_lead_contract`.
 *
 * REDACTION garantida:
 *  - O SELECT lista APENAS as 6 colunas de metadado mínimo (whitelist explícita).
 *  - Colunas potencialmente sensíveis da tabela (actor_ip, actor_user_agent)
 *    NUNCA são requisitadas do backend, portanto nunca chegam ao browser.
 *  - Uma checagem de segurança pós-fetch (SENSITIVE_KEYS) remove qualquer chave
 *    inesperada antes de renderizar, mesmo que a tabela ganhe colunas novas.
 *
 * Filtros: lead_id (UUID), from/to (datas), outcome.
 * Paginação: server-side (range) com PAGE_SIZE=25.
 * Ordenação: created_at | outcome | action (asc/desc), controlada por header.
 * Acesso: RLS admin-only + AdminGuard na rota.
 */
import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import {
  ShieldCheck, Filter, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  ArrowDownUp, ArrowDown, ArrowUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Outcome = 'success' | 'invalid_token' | 'expired' | 'already_claimed' | 'invalid_arguments' | 'rate_limited';
type SortField = 'created_at' | 'outcome' | 'action';
type SortDir = 'asc' | 'desc';

/**
 * Whitelist de campos exibíveis. QUALQUER outro campo é removido antes de render.
 * Testado em src/pages/admin/__tests__/AdminSponsorDocsAuditPage.redaction.test.ts.
 */
export const AUDIT_SAFE_FIELDS = ['id', 'lead_id', 'action', 'outcome', 'fields_present', 'created_at'] as const;
export const SENSITIVE_KEYS = [
  'actor_ip', 'actor_user_agent', 'metadata', 'payload', 'cnpj', 'cnpj_document_url',
  'banner_url', 'additional_docs', 'email', 'phone', 'whatsapp', 'tax_id',
] as const;

export type AuditRow = {
  id: string;
  lead_id: string;
  action: 'attach_docs' | 'contract_accept';
  outcome: Outcome;
  fields_present: string[];
  created_at: string;
};

/** Remove qualquer chave sensível/inesperada do payload devolvido pelo backend. */
export function redactAuditRows(rows: unknown[]): AuditRow[] {
  return (rows ?? []).map((raw) => {
    const src = (raw ?? {}) as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const key of AUDIT_SAFE_FIELDS) {
      if (key in src) clean[key] = (src as any)[key];
    }
    // Sanity check: nenhum SENSITIVE_KEY deve sobreviver.
    for (const banned of SENSITIVE_KEYS) delete clean[banned];
    return clean as unknown as AuditRow;
  });
}

const OUTCOME_STYLES: Record<Outcome, string> = {
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  invalid_token: 'bg-red-100 text-red-800 border-red-200',
  expired: 'bg-amber-100 text-amber-800 border-amber-200',
  already_claimed: 'bg-blue-100 text-blue-800 border-blue-200',
  invalid_arguments: 'bg-slate-100 text-slate-800 border-slate-200',
  rate_limited: 'bg-purple-100 text-purple-800 border-purple-200',
};

const PAGE_SIZE = 25;
const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

const AdminSponsorDocsAuditPage = () => {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [leadId, setLeadId] = useState('');
  const [from, setFrom] = useState(weekAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [outcome, setOutcome] = useState<Outcome | 'all'>('all');
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filters = useMemo(
    () => ({ leadId: leadId.trim(), from, to, outcome, page, sortField, sortDir }),
    [leadId, from, to, outcome, page, sortField, sortDir],
  );

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['admin-sponsor-docs-audit', filters],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      const start = filters.page * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;
      let q = supabase
        .from('sponsor_lead_docs_audit' as any)
        .select(AUDIT_SAFE_FIELDS.join(','), { count: 'exact' })
        .order(filters.sortField, { ascending: filters.sortDir === 'asc' })
        .range(start, end);
      if (filters.leadId && isUuid(filters.leadId)) q = q.eq('lead_id', filters.leadId);
      if (filters.from) q = q.gte('created_at', `${filters.from}T00:00:00Z`);
      if (filters.to) q = q.lte('created_at', `${filters.to}T23:59:59Z`);
      if (filters.outcome !== 'all') q = q.eq('outcome', filters.outcome);
      const { data: rows, error: err, count } = await q;
      if (err) throw err;
      return { rows: redactAuditRows((rows ?? []) as unknown[]), count: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const stats = useMemo(() => {
    const acc: Record<string, number> = { total: rows.length };
    for (const r of rows) acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
    return acc;
  }, [rows]);

  const toggleSort = (f: SortField) => {
    setPage(0);
    if (f === sortField) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(f); setSortDir('desc'); }
  };
  const SortIcon = ({ f }: { f: SortField }) =>
    sortField !== f ? <ArrowDownUp className="h-3 w-3 opacity-40" />
      : sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Trilha das RPCs seguras (attach_sponsor_lead_docs · accept_sponsor_lead_contract)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Apenas metadados são exibidos: lead_id, ação, resultado, quais campos foram enviados e horário.
              Conteúdo dos arquivos, CNPJ, e-mail, telefone e demais dados sensíveis <strong>nunca</strong>{' '}
              aparecem aqui — a UI aplica whitelist explícita antes de renderizar.
              O acesso à tabela é restrito por RLS a administradores.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Filter className="h-4 w-4" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="leadId" className="text-xs">Lead ID (UUID)</Label>
              <Input
                id="leadId"
                value={leadId}
                onChange={(e) => { setLeadId(e.target.value); setPage(0); }}
                placeholder="00000000-0000-0000-0000-000000000000"
                data-testid="filter-lead-id"
              />
              {leadId && !isUuid(leadId) && (
                <p className="text-[11px] text-red-600">Formato inválido — deve ser UUID.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs">De</Label>
              <Input id="from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} data-testid="filter-from" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs">Até</Label>
              <Input id="to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} data-testid="filter-to" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Resultado</Label>
              <Select value={outcome} onValueChange={(v) => { setOutcome(v as any); setPage(0); }}>
                <SelectTrigger data-testid="filter-outcome"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">success</SelectItem>
                  <SelectItem value="invalid_token">invalid_token</SelectItem>
                  <SelectItem value="expired">expired</SelectItem>
                  <SelectItem value="already_claimed">already_claimed</SelectItem>
                  <SelectItem value="invalid_arguments">invalid_arguments</SelectItem>
                  <SelectItem value="rate_limited">rate_limited</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-5 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-2 md:grid-cols-6">
          {(['total', 'success', 'invalid_token', 'expired', 'already_claimed', 'rate_limited'] as const).map((k) => (
            <Card key={k}>
              <CardContent className="py-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k === 'total' ? 'nesta página' : k}</p>
                <p className="text-lg font-semibold">{stats[k] ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="pt-4">
            {error ? (
              <p className="text-sm text-red-600">Erro ao carregar auditoria: {(error as Error).message}</p>
            ) : isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum registro no intervalo/lead selecionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('created_at')} data-testid="sort-created">
                          Horário <SortIcon f="created_at" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('action')} data-testid="sort-action">
                          Ação <SortIcon f="action" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('outcome')} data-testid="sort-outcome">
                          Resultado <SortIcon f="outcome" />
                        </button>
                      </TableHead>
                      <TableHead>Lead ID</TableHead>
                      <TableHead>Campos enviados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id} data-testid="audit-row">
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(row.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-xs">{row.action}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={OUTCOME_STYLES[row.outcome]}>
                            {row.outcome}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">{row.lead_id}</TableCell>
                        <TableCell className="text-xs">
                          {row.fields_present?.length
                            ? row.fields_present.map((f) => (
                                <Badge key={f} variant="secondary" className="mr-1 mb-1 text-[10px]">{f}</Badge>
                              ))
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span>
                    Página {page + 1} de {totalPages} · {total} registro(s)
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline" size="sm" data-testid="page-prev"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0 || isFetching}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                    </Button>
                    <Button
                      variant="outline" size="sm" data-testid="page-next"
                      onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
                      disabled={page + 1 >= totalPages || isFetching}
                    >
                      Próxima <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSponsorDocsAuditPage;
