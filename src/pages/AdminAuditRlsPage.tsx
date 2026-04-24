import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, ShieldCheck, Search, RefreshCw, AlertTriangle, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface RlsPolicy {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: string;
  roles: string[] | null;
  cmd: string;
  qual: string | null;
  with_check: string | null;
}

const CMD_VARIANT: Record<string, string> = {
  SELECT: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  INSERT: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  UPDATE: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  DELETE: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
  ALL: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
};

function isPermissiveTrue(value: string | null): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() === 'true';
}

function isWriteCmd(cmd: string): boolean {
  return cmd === 'INSERT' || cmd === 'UPDATE' || cmd === 'DELETE' || cmd === 'ALL';
}

const AdminAuditRlsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [policies, setPolicies] = useState<RlsPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'permissive' | 'public' | 'anon'>('all');

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
    if (filter === 'permissive') {
      list = list.filter(p => isWriteCmd(p.cmd) && (isPermissiveTrue(p.qual) || isPermissiveTrue(p.with_check)));
    } else if (filter === 'public') {
      list = list.filter(p => (p.roles ?? []).includes('public'));
    } else if (filter === 'anon') {
      list = list.filter(p => (p.roles ?? []).includes('anon'));
    }
    return list;
  }, [policies, search, filter]);

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
    const permissiveWrites = policies.filter(p => isWriteCmd(p.cmd) && (isPermissiveTrue(p.qual) || isPermissiveTrue(p.with_check))).length;
    const publicAccess = policies.filter(p => (p.roles ?? []).includes('public')).length;
    return { total, tables, permissiveWrites, publicAccess };
  }, [policies]);

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
            Lista todas as políticas Row Level Security ativas no schema <code className="font-mono">public</code>, agrupadas por tabela.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPolicies} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Políticas totais" value={stats.total} icon={<Lock className="h-4 w-4" />} />
        <StatCard label="Tabelas cobertas" value={stats.tables} icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />} />
        <StatCard
          label="Write permissivas"
          value={stats.permissiveWrites}
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          highlight={stats.permissiveWrites > 0}
        />
        <StatCard
          label="Acesso a 'public'"
          value={stats.publicAccess}
          icon={<ShieldAlert className="h-4 w-4 text-rose-500" />}
        />
      </div>

      {/* Filters */}
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
        <div className="flex gap-2 flex-wrap">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>Todas</FilterChip>
          <FilterChip active={filter === 'permissive'} onClick={() => setFilter('permissive')} variant="warn">
            Permissivas em write
          </FilterChip>
          <FilterChip active={filter === 'public'} onClick={() => setFilter('public')} variant="warn">
            Acesso público
          </FilterChip>
          <FilterChip active={filter === 'anon'} onClick={() => setFilter('anon')} variant="warn">
            Acesso anon
          </FilterChip>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Legenda:</strong> políticas em <span className="text-amber-600 dark:text-amber-400 font-semibold">amarelo</span> têm <code className="font-mono">qual=true</code> ou <code className="font-mono">with_check=true</code> em comandos de escrita (INSERT/UPDATE/DELETE) — revisar.
        Roles <code className="font-mono">public</code> ou <code className="font-mono">anon</code> indicam acesso sem autenticação.
      </div>

      {/* Tables */}
      <div className="mt-5 space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Carregando políticas...</p>}
        {!loading && grouped.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma política encontrada com os filtros atuais.</p>
        )}
        {grouped.map(([table, polices]) => (
          <div key={table} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
              <h2 className="font-mono text-sm font-bold text-foreground">{table}</h2>
              <Badge variant="outline" className="text-xs">{polices.length} {polices.length === 1 ? 'política' : 'políticas'}</Badge>
            </div>
            <div className="divide-y divide-border">
              {polices.map(p => {
                const permTrue = isWriteCmd(p.cmd) && (isPermissiveTrue(p.qual) || isPermissiveTrue(p.with_check));
                const hasPublic = (p.roles ?? []).includes('public') || (p.roles ?? []).includes('anon');
                return (
                  <div key={`${p.tablename}.${p.policyname}.${p.cmd}`} className={`p-4 ${permTrue ? 'bg-amber-500/5' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CMD_VARIANT[p.cmd] || CMD_VARIANT.ALL}`}>
                        {p.cmd}
                      </span>
                      <span className="font-medium text-sm text-foreground">{p.policyname}</span>
                      {permTrue && (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/20 text-[10px]">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Permissiva
                        </Badge>
                      )}
                      {hasPublic && (
                        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/20 text-[10px]">
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
        ))}
      </div>
    </AdminLayout>
  );
};

const StatCard = ({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean }) => (
  <div className={`rounded-xl border p-4 shadow-card ${highlight ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card'}`}>
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <div className="mt-1 font-display text-2xl font-bold text-foreground">{value}</div>
  </div>
);

const FilterChip = ({ active, onClick, children, variant }: { active: boolean; onClick: () => void; children: React.ReactNode; variant?: 'warn' }) => (
  <button
    onClick={onClick}
    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
      active
        ? variant === 'warn'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
          : 'bg-primary text-primary-foreground border-primary'
        : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
    }`}
  >
    {children}
  </button>
);

export default AdminAuditRlsPage;
