import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Loader2, RefreshCw, ShieldCheck, AlertTriangle, Wand2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuditRow {
  sponsor_id: string;
  sponsor_name: string;
  sponsor_type: string;
  linked_city: string | null;
  linked_city_slug: string | null;
  suggested_city: string | null;
  suggested_city_slug: string | null;
  linked_category: string | null;
  linked_category_slug: string | null;
  suggested_category: string | null;
  suggested_category_slug: string | null;
  issue_type: string;
  confidence: 'high' | 'medium' | 'low';
  auto_fixable: boolean;
}

const ISSUE_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | 'crit' }> = {
  ok: { label: 'Consistente', tone: 'ok' },
  missing_city: { label: 'Cidade ausente', tone: 'crit' },
  missing_category: { label: 'Categoria ausente', tone: 'crit' },
  city_not_in_catalog: { label: 'Cidade fora do catálogo', tone: 'crit' },
  city_slug_mismatch: { label: 'Slug de cidade divergente', tone: 'warn' },
  city_label_differs: { label: 'Label de cidade diferente', tone: 'warn' },
  category_not_in_catalog: { label: 'Categoria fora do catálogo', tone: 'crit' },
  category_slug_mismatch: { label: 'Slug de categoria divergente', tone: 'warn' },
};

const toneClass = (tone: 'ok' | 'warn' | 'crit') =>
  tone === 'ok'
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
    : tone === 'warn'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';

const SponsorConsistencyPanel = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showOk, setShowOk] = useState(false);

  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sponsor-scope-consistency'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('audit_sponsor_scope_consistency' as any);
      if (error) throw error;
      return (data as AuditRow[]) || [];
    },
    staleTime: 60_000,
  });

  const applyFix = useMutation({
    mutationFn: async (row: AuditRow) => {
      const { data, error } = await supabase.rpc('apply_sponsor_scope_fix' as any, {
        _sponsor_id: row.sponsor_id,
        _new_city: row.suggested_city ?? null,
        _new_category: row.suggested_category ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Correção aplicada', description: 'Patrocinador atualizado com valor canônico.' });
      qc.invalidateQueries({ queryKey: ['sponsor-scope-consistency'] });
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
    },
    onError: (e: any) => {
      toast({ title: 'Falha ao aplicar', description: e?.message ?? 'Erro desconhecido', variant: 'destructive' });
    },
  });

  // ─── KPIs ───
  const total = data.length;
  const consistent = data.filter((r) => r.issue_type === 'ok').length;
  const critical = data.filter(
    (r) => ISSUE_LABEL[r.issue_type]?.tone === 'crit',
  ).length;
  const warnings = data.filter(
    (r) => ISSUE_LABEL[r.issue_type]?.tone === 'warn',
  ).length;
  const autoFixable = data.filter((r) => r.auto_fixable).length;
  const consistentPct = total === 0 ? 100 : Math.round((consistent / total) * 100);

  const visible = showOk ? data : data.filter((r) => r.issue_type !== 'ok');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Consistência de escopo
          </h3>
          <p className="text-xs text-muted-foreground">
            Diagnóstico read-only do legado. Correções são manuais e individuais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowOk((v) => !v)}>
            {showOk ? 'Ocultar consistentes' : 'Mostrar consistentes'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Consistentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{consistent}</p>
            <p className="text-[10px] text-muted-foreground">{consistentPct}% do inventário</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Avisos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{warnings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Críticas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{critical}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Auto-fixáveis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{autoFixable}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando auditoria...
            </div>
          ) : visible.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
              {showOk ? 'Nenhum patrocinador encontrado.' : 'Nenhuma inconsistência detectada no inventário atual.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patrocinador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Atual</TableHead>
                    <TableHead>Sugerido</TableHead>
                    <TableHead>Problema</TableHead>
                    <TableHead>Confiança</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row) => {
                    const meta = ISSUE_LABEL[row.issue_type] ?? { label: row.issue_type, tone: 'warn' as const };
                    const isCity = row.sponsor_type === 'city';
                    const current = isCity ? row.linked_city : row.linked_category;
                    const currentSlug = isCity ? row.linked_city_slug : row.linked_category_slug;
                    const suggested = isCity ? row.suggested_city : row.suggested_category;
                    const suggestedSlug = isCity ? row.suggested_city_slug : row.suggested_category_slug;
                    return (
                      <TableRow key={row.sponsor_id}>
                        <TableCell className="font-medium text-sm">{row.sponsor_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {row.sponsor_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {current || <span className="text-muted-foreground italic">vazio</span>}
                          {currentSlug && (
                            <div className="text-[10px] text-muted-foreground font-mono">{currentSlug}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {suggested ? (
                            <>
                              <span className="text-emerald-700 dark:text-emerald-400">{suggested}</span>
                              <div className="text-[10px] text-muted-foreground font-mono">{suggestedSlug}</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${toneClass(meta.tone)}`}>
                            {meta.tone === 'crit' && <AlertTriangle className="h-3 w-3 mr-1 inline" />}
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {row.confidence}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.auto_fixable ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={applyFix.isPending}
                              onClick={() => applyFix.mutate(row)}
                            >
                              <Wand2 className="h-3 w-3 mr-1" />
                              Aplicar
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">manual</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground">
        Auto-fix só é oferecido quando o slug normalizado do valor atual coincide com o do canônico — ou seja, mesma cidade/categoria,
        apenas grafia diferente. Casos ambíguos exigem edição manual no formulário do patrocinador.
      </p>
    </div>
  );
};

export default SponsorConsistencyPanel;
