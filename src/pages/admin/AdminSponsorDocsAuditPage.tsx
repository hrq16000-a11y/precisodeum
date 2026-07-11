/**
 * /admin/sponsor-docs-audit — Trilha de auditoria da RPC attach_sponsor_lead_docs
 * e accept_sponsor_lead_contract.
 *
 * Mostra apenas metadados mínimos (lead_id, action, outcome, campos presentes,
 * created_at). NUNCA exibe conteúdo dos arquivos ou dados sensíveis (CNPJ,
 * e-mail, telefone). O acesso à tabela é restrito a admins via RLS
 * (`has_role(auth.uid(), 'admin')`).
 *
 * Filtros:
 *  - lead_id (uuid exato)
 *  - intervalo de datas (from/to)
 *  - outcome (opcional)
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { ShieldCheck, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Outcome = 'success' | 'invalid_token' | 'expired' | 'already_claimed' | 'invalid_arguments' | 'rate_limited';

interface AuditRow {
  id: string;
  lead_id: string;
  action: 'attach_docs' | 'contract_accept';
  outcome: Outcome;
  fields_present: string[];
  created_at: string;
}

const OUTCOME_STYLES: Record<Outcome, string> = {
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  invalid_token: 'bg-red-100 text-red-800 border-red-200',
  expired: 'bg-amber-100 text-amber-800 border-amber-200',
  already_claimed: 'bg-blue-100 text-blue-800 border-blue-200',
  invalid_arguments: 'bg-slate-100 text-slate-800 border-slate-200',
  rate_limited: 'bg-purple-100 text-purple-800 border-purple-200',
};

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

const AdminSponsorDocsAuditPage = () => {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [leadId, setLeadId] = useState('');
  const [from, setFrom] = useState(weekAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [outcome, setOutcome] = useState<Outcome | 'all'>('all');

  const filters = useMemo(
    () => ({ leadId: leadId.trim(), from, to, outcome }),
    [leadId, from, to, outcome],
  );

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['admin-sponsor-docs-audit', filters],
    queryFn: async () => {
      let q = supabase
        .from('sponsor_lead_docs_audit' as any)
        .select('id, lead_id, action, outcome, fields_present, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (filters.leadId && isUuid(filters.leadId)) q = q.eq('lead_id', filters.leadId);
      if (filters.from) q = q.gte('created_at', `${filters.from}T00:00:00Z`);
      if (filters.to) q = q.lte('created_at', `${filters.to}T23:59:59Z`);
      if (filters.outcome !== 'all') q = q.eq('outcome', filters.outcome);
      const { data: rows, error: err } = await q;
      if (err) throw err;
      return (rows ?? []) as unknown as AuditRow[];
    },
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const rows = data ?? [];
    const acc: Record<string, number> = { total: rows.length };
    for (const r of rows) acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
    return acc;
  }, [data]);

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
              aparecem aqui. O acesso é restrito por RLS a administradores.
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
                onChange={(e) => setLeadId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                data-testid="filter-lead-id"
              />
              {leadId && !isUuid(leadId) && (
                <p className="text-[11px] text-red-600">Formato inválido — deve ser UUID.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs">De</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="filter-from" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs">Até</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="filter-to" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Resultado</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as any)}>
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
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
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
            ) : (data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum registro no intervalo/lead selecionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Horário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Lead ID</TableHead>
                      <TableHead>Campos enviados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data ?? []).map((row) => (
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
                <p className="text-[11px] text-muted-foreground mt-2">
                  Mostrando até 500 registros ordenados por horário decrescente.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSponsorDocsAuditPage;
