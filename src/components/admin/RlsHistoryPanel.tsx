import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, GitCompare, Plus, Minus, Pencil, RefreshCw, ShieldAlert, Camera } from 'lucide-react';
import { toast } from 'sonner';

interface SnapshotDate {
  out_snapshot_date: string;
  policy_count: number;
  permissive_write_count: number;
}

interface DiffRow {
  status: 'added' | 'removed' | 'changed';
  schemaname: string;
  tablename: string;
  policyname: string;
  cmd_old: string | null;
  cmd_new: string | null;
  roles_old: string[] | null;
  roles_new: string[] | null;
  qual_old: string | null;
  qual_new: string | null;
  with_check_old: string | null;
  with_check_new: string | null;
  is_permissive_write_new: boolean;
  is_public_or_anon_new: boolean;
}

const RlsHistoryPanel = () => {
  const [dates, setDates] = useState<SnapshotDate[]>([]);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [diff, setDiff] = useState<DiffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const loadDates = async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)('admin_list_rls_snapshot_dates');
    if (error) {
      toast.error('Erro ao carregar histórico: ' + error.message);
      setDates([]);
    } else {
      const list = (data as SnapshotDate[]) || [];
      setDates(list);
      if (list.length >= 2) {
        setToDate(list[0].out_snapshot_date);
        setFromDate(list[1].out_snapshot_date);
      } else if (list.length === 1) {
        setToDate(list[0].out_snapshot_date);
        setFromDate(list[0].out_snapshot_date);
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadDates(); }, []);

  const runDiff = async () => {
    if (!fromDate || !toDate) return;
    setDiffLoading(true);
    const { data, error } = await (supabase.rpc as any)('admin_diff_rls_snapshots', {
      from_date: fromDate,
      to_date: toDate,
    });
    if (error) {
      toast.error('Erro ao comparar: ' + error.message);
      setDiff([]);
    } else {
      setDiff((data as DiffRow[]) || []);
    }
    setDiffLoading(false);
  };

  const captureNow = async () => {
    setCapturing(true);
    const { data, error } = await (supabase.rpc as any)('admin_capture_rls_snapshot');
    if (error) {
      toast.error('Erro ao capturar: ' + error.message);
    } else {
      const inserted = Array.isArray(data) ? data[0]?.out_inserted_count ?? 0 : 0;
      toast.success(`Snapshot capturado: ${inserted} políticas registradas hoje`);
      await loadDates();
    }
    setCapturing(false);
  };

  const summary = useMemo(() => {
    const added = diff.filter(d => d.status === 'added');
    const removed = diff.filter(d => d.status === 'removed');
    const changed = diff.filter(d => d.status === 'changed');
    const newRisky = added.filter(d => d.is_permissive_write_new && d.is_public_or_anon_new);
    return { added, removed, changed, newRisky };
  }, [diff]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2.5 flex-wrap">
        <h2 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico de mudanças (snapshots diários)
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={captureNow} disabled={capturing}>
            <Camera className={`mr-2 h-3.5 w-3.5 ${capturing ? 'animate-pulse' : ''}`} />
            Capturar agora
          </Button>
          <Button variant="ghost" size="sm" onClick={loadDates} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {dates.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">
            Nenhum snapshot encontrado. Clique em "Capturar agora" para iniciar o histórico.
          </p>
        )}

        {dates.length > 0 && (
          <>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-muted-foreground font-medium mb-1 block">De (versão antiga)</label>
                <Select value={fromDate} onValueChange={setFromDate}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {dates.map(d => (
                      <SelectItem key={`from-${d.out_snapshot_date}`} value={d.out_snapshot_date}>
                        {d.out_snapshot_date} · {d.policy_count} políticas
                        {d.permissive_write_count > 0 && ` · ${d.permissive_write_count} risco`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <GitCompare className="h-5 w-5 text-muted-foreground mb-2" />
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Para (versão nova)</label>
                <Select value={toDate} onValueChange={setToDate}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {dates.map(d => (
                      <SelectItem key={`to-${d.out_snapshot_date}`} value={d.out_snapshot_date}>
                        {d.out_snapshot_date} · {d.policy_count} políticas
                        {d.permissive_write_count > 0 && ` · ${d.permissive_write_count} risco`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={runDiff} disabled={diffLoading || !fromDate || !toDate}>
                <GitCompare className={`mr-2 h-4 w-4 ${diffLoading ? 'animate-pulse' : ''}`} />
                Comparar
              </Button>
            </div>

            {/* Alerta de novas policies arriscadas */}
            {summary.newRisky.length > 0 && (
              <div className="rounded-lg border-2 border-rose-500/40 bg-rose-500/5 p-3">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-rose-700 dark:text-rose-300">
                      {summary.newRisky.length} nova{summary.newRisky.length > 1 ? 's' : ''} política{summary.newRisky.length > 1 ? 's' : ''} permissiva{summary.newRisky.length > 1 ? 's' : ''} com acesso public/anon
                    </p>
                    <ul className="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80 space-y-0.5">
                      {summary.newRisky.slice(0, 8).map(d => (
                        <li key={`risky-${d.tablename}-${d.policyname}`} className="font-mono">
                          • {d.tablename}.{d.policyname} ({d.cmd_new})
                        </li>
                      ))}
                      {summary.newRisky.length > 8 && (
                        <li className="italic">…e mais {summary.newRisky.length - 8}</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Resumo */}
            {diff.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <SummaryChip count={summary.added.length} label="Adicionadas" icon={<Plus className="h-3.5 w-3.5" />} tone="add" />
                <SummaryChip count={summary.removed.length} label="Removidas" icon={<Minus className="h-3.5 w-3.5" />} tone="remove" />
                <SummaryChip count={summary.changed.length} label="Alteradas" icon={<Pencil className="h-3.5 w-3.5" />} tone="change" />
              </div>
            )}

            {/* Lista de mudanças */}
            {diff.length > 0 && (
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {diff.map((d, i) => (
                  <DiffEntry key={`${d.status}-${d.tablename}-${d.policyname}-${i}`} d={d} />
                ))}
              </div>
            )}

            {diff.length === 0 && fromDate && toDate && !diffLoading && (
              <p className="text-sm text-muted-foreground italic">
                {fromDate === toDate
                  ? 'Selecione duas datas diferentes para comparar.'
                  : 'Nenhuma diferença encontrada entre os dois snapshots.'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const SummaryChip = ({ count, label, icon, tone }: { count: number; label: string; icon: React.ReactNode; tone: 'add' | 'remove' | 'change' }) => {
  const cls =
    tone === 'add' ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
    : tone === 'remove' ? 'border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300'
    : 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300';
  return (
    <div className={`rounded-lg border p-2.5 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-80">{icon}{label}</div>
      <div className="font-display text-xl font-bold mt-0.5">{count}</div>
    </div>
  );
};

const DiffEntry = ({ d }: { d: DiffRow }) => {
  const tone =
    d.status === 'added' ? 'border-emerald-500/30 bg-emerald-500/5'
    : d.status === 'removed' ? 'border-rose-500/30 bg-rose-500/5'
    : 'border-amber-500/30 bg-amber-500/5';
  const icon =
    d.status === 'added' ? <Plus className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
    : d.status === 'removed' ? <Minus className="h-3 w-3 text-rose-600 dark:text-rose-400" />
    : <Pencil className="h-3 w-3 text-amber-600 dark:text-amber-400" />;
  const isRisky = d.status === 'added' && d.is_permissive_write_new && d.is_public_or_anon_new;

  return (
    <div className={`rounded border p-2 text-xs ${tone} ${isRisky ? 'ring-1 ring-rose-500/40' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {icon}
        <code className="font-mono text-[11px] font-bold">{d.tablename}.{d.policyname}</code>
        {(d.cmd_new || d.cmd_old) && (
          <Badge variant="outline" className="text-[9px] py-0 h-4">{d.cmd_new || d.cmd_old}</Badge>
        )}
        {isRisky && (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 text-[9px] py-0 h-4">
            <ShieldAlert className="h-2.5 w-2.5 mr-0.5" /> Risco
          </Badge>
        )}
      </div>
      {d.status === 'changed' && (
        <div className="mt-1.5 grid gap-1 sm:grid-cols-2 font-mono text-[10px]">
          {d.qual_old !== d.qual_new && (
            <>
              <div className="text-rose-600 dark:text-rose-400 truncate">- {d.qual_old || '(null)'}</div>
              <div className="text-emerald-600 dark:text-emerald-400 truncate">+ {d.qual_new || '(null)'}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RlsHistoryPanel;
