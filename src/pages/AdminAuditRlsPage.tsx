import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, ShieldCheck, Search, RefreshCw, AlertTriangle, Lock, FileJson, FileSpreadsheet, FolderDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import RlsHistoryPanel from '@/components/admin/RlsHistoryPanel';

interface RlsPolicy {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: string;
  roles: string[] | null;
  cmd: string;
  qual: string | null;
  with_check: string | null;
  table_owner?: string | null;
}

const CMD_VARIANT: Record<string, string> = {
  SELECT: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  INSERT: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  UPDATE: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  DELETE: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
  ALL: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
};

const ALL_ROLES = ['anon', 'authenticated', 'public', 'service_role'] as const;
const ALL_CMDS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'] as const;

function isPermissiveTrue(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() === 'true';
}
function isWriteCmd(cmd: string): boolean {
  return cmd === 'INSERT' || cmd === 'UPDATE' || cmd === 'DELETE' || cmd === 'ALL';
}
function isCriticalRisk(p: RlsPolicy): boolean {
  if (!isWriteCmd(p.cmd)) return false;
  if (!(isPermissiveTrue(p.qual) || isPermissiveTrue(p.with_check))) return false;
  const roles = p.roles ?? [];
  return roles.includes('public') || roles.includes('anon');
}
function isPermissiveWrite(p: RlsPolicy): boolean {
  return isWriteCmd(p.cmd) && (isPermissiveTrue(p.qual) || isPermissiveTrue(p.with_check));
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsv(rows: RlsPolicy[]): string {
  const headers = ['schema', 'table', 'policy', 'permissive', 'cmd', 'roles', 'qual', 'with_check', 'table_owner'];
  const escape = (v: string | null | undefined) => {
    const s = (v ?? '').toString().replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.schemaname, r.tablename, r.policyname, r.permissive, r.cmd,
      (r.roles ?? []).join('|'), r.qual ?? '', r.with_check ?? '', r.table_owner ?? '',
    ].map(escape).join(','));
  }
  return lines.join('\n');
}

/** CSV agrupado por tabela, com seções por comando (INSERT/UPDATE/DELETE/SELECT/ALL) e roles. */
function toGroupedCsv(rows: RlsPolicy[]): string {
  const escape = (v: string | null | undefined) => {
    const s = (v ?? '').toString().replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };
  const tables = new Map<string, RlsPolicy[]>();
  for (const r of rows) {
    if (!tables.has(r.tablename)) tables.set(r.tablename, []);
    tables.get(r.tablename)!.push(r);
  }
  const sortedTables = Array.from(tables.keys()).sort();
  const lines: string[] = [];
  const cmdOrder = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'];

  for (const table of sortedTables) {
    const polices = tables.get(table)!;
    lines.push('');
    lines.push(`### TABELA: ${table} (${polices.length} políticas)`);
    for (const cmd of cmdOrder) {
      const cmdPolices = polices.filter(p => p.cmd === cmd);
      if (cmdPolices.length === 0) continue;
      lines.push('');
      lines.push(`-- ${cmd} (${cmdPolices.length})`);
      lines.push(['policy', 'roles', 'permissive', 'qual', 'with_check'].join(','));
      for (const p of cmdPolices) {
        lines.push([p.policyname, (p.roles ?? []).join('|'), p.permissive, p.qual ?? '', p.with_check ?? ''].map(escape).join(','));
      }
    }
  }
  return lines.join('\n');
}

const AdminAuditRlsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [policies, setPolicies] = useState<RlsPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'permissive' | 'public_access'>('all');
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [selectedCmds, setSelectedCmds] = useState<Set<string>>(new Set());

  const fetchPolicies = async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)('admin_list_rls_policies');
    if (error) {
      toast.error('Erro ao carregar políticas: ' + error.message);
      setPolicies([]);
    } else {
      setPolicies((data as RlsPolicy[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchPolicies();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    let list = policies;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.tablename.toLowerCase().includes(q) ||
        p.policyname.toLowerCase().includes(q) ||
        (p.qual ?? '').toLowerCase().includes(q) ||
        (p.with_check ?? '').toLowerCase().includes(q),
      );
    }
    if (riskFilter === 'critical') list = list.filter(isCriticalRisk);
    else if (riskFilter === 'permissive') list = list.filter(isPermissiveWrite);
    else if (riskFilter === 'public_access') {
      list = list.filter(p => (p.roles ?? []).some(r => r === 'public' || r === 'anon'));
    }
    if (selectedRoles.size > 0) {
      list = list.filter(p => (p.roles ?? []).some(r => selectedRoles.has(r)));
    }
    if (selectedCmds.size > 0) {
      list = list.filter(p => selectedCmds.has(p.cmd));
    }
    return list;
  }, [policies, search, riskFilter, selectedRoles, selectedCmds]);

  const grouped = useMemo(() => {
    const map = new Map<string, RlsPolicy[]>();
    for (const p of filtered) {
      if (!map.has(p.tablename)) map.set(p.tablename, []);
      map.get(p.tablename)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const stats = useMemo(() => {
    const total = policies.length;
    const tables = new Set(policies.map(p => p.tablename)).size;
    const permissiveWrites = policies.filter(isPermissiveWrite).length;
    const publicAccess = policies.filter(p => (p.roles ?? []).some(r => r === 'public' || r === 'anon')).length;
    const critical = policies.filter(isCriticalRisk);
    const criticalTables = Array.from(new Set(critical.map(p => p.tablename))).sort();
    return { total, tables, permissiveWrites, publicAccess, criticalCount: critical.length, criticalTables };
  }, [policies]);

  const toggleSet = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(key)) n.delete(key); else n.add(key);
    setter(n);
  };

  const exportCsv = () => {
    if (!filtered.length) { toast.error('Nada para exportar'); return; }
    const csv = toCsv(filtered);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadBlob(csv, `rls-audit-${ts}.csv`, 'text/csv;charset=utf-8');
    toast.success(`${filtered.length} políticas exportadas (CSV)`);
  };

  const exportGroupedCsv = () => {
    if (!filtered.length) { toast.error('Nada para exportar'); return; }
    const csv = toGroupedCsv(filtered);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadBlob(csv, `rls-audit-grouped-${ts}.csv`, 'text/csv;charset=utf-8');
    toast.success(`Relatório agrupado exportado (${filtered.length} políticas)`);
  };

  const exportJson = () => {
    if (!filtered.length) { toast.error('Nada para exportar'); return; }
    const payload = {
      exported_at: new Date().toISOString(),
      filters: {
        search, riskFilter,
        roles: Array.from(selectedRoles),
        cmds: Array.from(selectedCmds),
      },
      total: filtered.length,
      policies: filtered,
    };
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadBlob(JSON.stringify(payload, null, 2), `rls-audit-${ts}.json`, 'application/json');
    toast.success(`${filtered.length} políticas exportadas (JSON)`);
  };

  const clearFilters = () => {
    setSearch(''); setRiskFilter('all');
    setSelectedRoles(new Set()); setSelectedCmds(new Set());
  };
  const activeFilterCount =
    (search ? 1 : 0) + (riskFilter !== 'all' ? 1 : 0) + selectedRoles.size + selectedCmds.size;

  if (adminLoading) {
    return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" /> Auditoria de Políticas RLS
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lista políticas Row Level Security ativas no schema <code className="font-mono">public</code>.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportGroupedCsv} disabled={!filtered.length}>
            <FolderDown className="mr-2 h-4 w-4" /> CSV agrupado
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson} disabled={!filtered.length}>
            <FileJson className="mr-2 h-4 w-4" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={fetchPolicies} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Risk summary */}
      {stats.criticalCount > 0 && (
        <div className="mt-5 rounded-xl border-2 border-rose-500/40 bg-rose-500/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-rose-700 dark:text-rose-300">
                {stats.criticalCount} {stats.criticalCount === 1 ? 'política crítica detectada' : 'políticas críticas detectadas'}
              </div>
              <p className="mt-1 text-sm text-rose-700/80 dark:text-rose-300/80">
                Escrita (INSERT/UPDATE/DELETE) com <code className="font-mono">qual=true</code> ou <code className="font-mono">with_check=true</code> envolvendo roles <code className="font-mono">public</code> ou <code className="font-mono">anon</code>.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stats.criticalTables.map(t => (
                  <button
                    key={t}
                    onClick={() => { setSearch(t); setRiskFilter('critical'); }}
                    className="font-mono text-xs rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 px-2 py-0.5 border border-rose-500/30 transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Políticas totais" value={stats.total} icon={<Lock className="h-4 w-4" />} />
        <StatCard label="Tabelas cobertas" value={stats.tables} icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />} />
        <StatCard label="Críticas" value={stats.criticalCount} icon={<ShieldAlert className="h-4 w-4 text-rose-500" />} highlight={stats.criticalCount > 0} highlightTone="critical" />
        <StatCard label="Write permissivas" value={stats.permissiveWrites} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} highlight={stats.permissiveWrites > 0} />
        <StatCard label="Acesso public/anon" value={stats.publicAccess} icon={<ShieldAlert className="h-4 w-4 text-rose-500" />} />
      </div>

      {/* Histórico de mudanças (snapshots diários) */}
      <div className="mt-5">
        <RlsHistoryPanel />
      </div>

      {/* Search */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por tabela, política ou expressão..."
            className="pl-9"
          />
        </div>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpar filtros ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Risk filters */}
      <div className="mt-3 flex gap-2 flex-wrap items-center">
        <span className="text-xs text-muted-foreground font-medium">Risco:</span>
        <FilterChip active={riskFilter === 'all'} onClick={() => setRiskFilter('all')}>Todas</FilterChip>
        <FilterChip active={riskFilter === 'critical'} onClick={() => setRiskFilter('critical')} variant="critical">Críticas</FilterChip>
        <FilterChip active={riskFilter === 'permissive'} onClick={() => setRiskFilter('permissive')} variant="warn">Write permissivas</FilterChip>
        <FilterChip active={riskFilter === 'public_access'} onClick={() => setRiskFilter('public_access')} variant="warn">Acesso public/anon</FilterChip>
      </div>

      {/* Role filters */}
      <div className="mt-2 flex gap-2 flex-wrap items-center">
        <span className="text-xs text-muted-foreground font-medium">Role:</span>
        {ALL_ROLES.map(r => (
          <FilterChip
            key={r}
            active={selectedRoles.has(r)}
            onClick={() => toggleSet(selectedRoles, r, setSelectedRoles)}
            variant={r === 'public' || r === 'anon' ? 'warn' : undefined}
          >
            <code className="font-mono text-[11px]">{r}</code>
          </FilterChip>
        ))}
      </div>

      {/* Cmd filters */}
      <div className="mt-2 flex gap-2 flex-wrap items-center">
        <span className="text-xs text-muted-foreground font-medium">Comando:</span>
        {ALL_CMDS.map(c => (
          <FilterChip
            key={c}
            active={selectedCmds.has(c)}
            onClick={() => toggleSet(selectedCmds, c, setSelectedCmds)}
          >
            {c}
          </FilterChip>
        ))}
      </div>

      {/* Tables */}
      <div className="mt-5 space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Carregando políticas...</p>}
        {!loading && grouped.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma política encontrada com os filtros atuais.</p>
        )}
        {grouped.map(([table, polices]) => {
          const tableHasCritical = polices.some(isCriticalRisk);
          const owner = polices[0]?.table_owner;
          return (
            <div key={table} className={`rounded-xl border bg-card shadow-card overflow-hidden ${tableHasCritical ? 'border-rose-500/40' : 'border-border'}`}>
              <div className={`flex items-center justify-between gap-2 border-b px-4 py-2.5 ${tableHasCritical ? 'border-rose-500/30 bg-rose-500/5' : 'border-border bg-muted/30'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="font-mono text-sm font-bold text-foreground truncate">{table}</h2>
                  {tableHasCritical && (
                    <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 text-[10px] shrink-0">
                      <ShieldAlert className="h-3 w-3 mr-1" /> Risco
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {owner && (
                    <span className="text-[10px] text-muted-foreground font-mono">owner: {owner}</span>
                  )}
                  <Badge variant="outline" className="text-xs">{polices.length}</Badge>
                </div>
              </div>
              <div className="divide-y divide-border">
                {polices.map(p => {
                  const permTrue = isPermissiveWrite(p);
                  const critical = isCriticalRisk(p);
                  const hasPublic = (p.roles ?? []).some(r => r === 'public' || r === 'anon');
                  return (
                    <div key={`${p.tablename}.${p.policyname}.${p.cmd}`} className={`p-4 ${critical ? 'bg-rose-500/5' : permTrue ? 'bg-amber-500/5' : ''}`}>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CMD_VARIANT[p.cmd] || CMD_VARIANT.ALL}`}>
                          {p.cmd}
                        </span>
                        <span className="font-medium text-sm text-foreground">{p.policyname}</span>
                        {critical && (
                          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 text-[10px]">
                            <ShieldAlert className="h-3 w-3 mr-1" /> Crítica
                          </Badge>
                        )}
                        {!critical && permTrue && (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 text-[10px]">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Permissiva
                          </Badge>
                        )}
                        {!critical && hasPublic && (
                          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 text-[10px]">
                            Acesso sem auth
                          </Badge>
                        )}
                        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                          {p.permissive}
                        </span>
                      </div>

                      <div className="grid gap-2 text-xs sm:grid-cols-[120px_1fr]">
                        <span className="text-muted-foreground font-medium">Roles:</span>
                        <div className="flex flex-wrap gap-1">
                          {(p.roles ?? []).map(r => (
                            <code
                              key={r}
                              className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] ${
                                r === 'public' || r === 'anon'
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {r}
                            </code>
                          ))}
                        </div>

                        {p.qual && (
                          <>
                            <span className="text-muted-foreground font-medium">USING (qual):</span>
                            <code className={`block rounded p-2 font-mono text-[11px] break-all ${isPermissiveTrue(p.qual) && isWriteCmd(p.cmd) ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-muted/50 text-foreground'}`}>
                              {p.qual}
                            </code>
                          </>
                        )}

                        {p.with_check && (
                          <>
                            <span className="text-muted-foreground font-medium">WITH CHECK:</span>
                            <code className={`block rounded p-2 font-mono text-[11px] break-all ${isPermissiveTrue(p.with_check) && isWriteCmd(p.cmd) ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-muted/50 text-foreground'}`}>
                              {p.with_check}
                            </code>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
};

const StatCard = ({ label, value, icon, highlight, highlightTone }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean; highlightTone?: 'critical' | 'warn' }) => {
  const tone = highlight
    ? highlightTone === 'critical'
      ? 'border-rose-500/40 bg-rose-500/5'
      : 'border-amber-500/40 bg-amber-500/5'
    : 'border-border bg-card';
  return (
    <div className={`rounded-xl border p-4 shadow-card ${tone}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 font-display text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
};

const FilterChip = ({ active, onClick, children, variant }: { active: boolean; onClick: () => void; children: React.ReactNode; variant?: 'warn' | 'critical' }) => {
  const activeCls =
    variant === 'critical' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
    : variant === 'warn' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
    : 'bg-primary text-primary-foreground border-primary';
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
        active ? activeCls : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
};

export default AdminAuditRlsPage;
