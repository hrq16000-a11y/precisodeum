import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Plus, Save, Trash2, Eye, CheckCircle2, XCircle, Clock, AlertTriangle, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { GovernanceScope } from '@/lib/governanceEngine';

const SCOPES: GovernanceScope[] = ['storage', 'sil', 'geo', 'ui', 'auth', 'ranking', 'global'];
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 border-green-500/20',
  deprecated: 'bg-muted text-muted-foreground border-border',
  testing: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
};

const AdminGovernancePage = () => {
  const { isAdmin, loading } = useAdmin();
  const [rules, setRules] = useState<any[]>([]);
  const [drifts, setDrifts] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [filterScope, setFilterScope] = useState<string>('all');

  const fetchAll = async () => {
    const [rulesRes, driftsRes, healthRes, approvalsRes] = await Promise.all([
      supabase.from('governance_rules' as any).select('*').order('scope'),
      supabase.from('system_drift_reports' as any).select('*').eq('resolved', false).order('detected_at', { ascending: false }).limit(50),
      supabase.from('runtime_component_health' as any).select('*').order('status').limit(50),
      supabase.from('governance_approvals' as any).select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
    ]);
    if (rulesRes.data) setRules(rulesRes.data);
    if (driftsRes.data) setDrifts(driftsRes.data);
    if (healthRes.data) setHealth(healthRes.data);
    if (approvalsRes.data) setApprovals(approvalsRes.data);
  };

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  const deleteRule = async (id: string) => {
    if (!confirm('Excluir esta regra?')) return;
    await (supabase.from('governance_rules' as any) as any).delete().eq('id', id);
    toast.success('Regra excluída');
    fetchAll();
  };

  const updateRuleStatus = async (id: string, status: string) => {
    await (supabase.from('governance_rules' as any) as any).update({ status }).eq('id', id);
    toast.success('Status atualizado');
    fetchAll();
  };

  const resolveApproval = async (id: string, status: 'approved' | 'rejected') => {
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase.from('governance_approvals' as any) as any).update({
      status,
      approved_by: user?.id,
      resolved_at: new Date().toISOString(),
    }).eq('id', id);
    toast.success(status === 'approved' ? 'Aprovado!' : 'Rejeitado');
    fetchAll();
  };

  const resolveDrift = async (id: string) => {
    const note = prompt('Nota de resolução:');
    if (!note) return;
    await (supabase.from('system_drift_reports' as any) as any).update({ resolved: true, resolution_note: note }).eq('id', id);
    toast.success('Drift resolvido');
    fetchAll();
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  const filteredRules = filterScope === 'all' ? rules : rules.filter((r: any) => r.scope === filterScope);
  const failingCount = health.filter((h: any) => h.status !== 'healthy').length;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6" /> Governance Engine
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rules.length} regras · {approvals.length} pendentes · {drifts.length} drifts · {failingCount} componentes instáveis
          </p>
        </div>
        <Button variant="accent" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nova Regra
        </Button>
      </div>

      <Tabs defaultValue="rules" className="mt-6">
        <TabsList>
          <TabsTrigger value="rules">Regras ({rules.length})</TabsTrigger>
          <TabsTrigger value="approvals">Aprovações ({approvals.length})</TabsTrigger>
          <TabsTrigger value="drifts">Drifts ({drifts.length})</TabsTrigger>
          <TabsTrigger value="health">Runtime ({health.length})</TabsTrigger>
        </TabsList>

        {/* RULES TAB */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className={`cursor-pointer ${filterScope === 'all' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setFilterScope('all')}>Todos</Badge>
            {SCOPES.map(s => (
              <Badge key={s} variant="outline" className={`cursor-pointer ${filterScope === s ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setFilterScope(s)}>{s}</Badge>
            ))}
          </div>
          {filteredRules.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-card space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.scope}</Badge>
                    <Badge className={STATUS_COLORS[r.status]}>{r.status}</Badge>
                    <span className="text-xs text-muted-foreground">v{r.version}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-bold text-foreground">{r.key}</h3>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Select value={r.status} onValueChange={(v) => updateRuleStatus(r.id, v)}>
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="testing">Testing</SelectItem>
                      <SelectItem value="deprecated">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => deleteRule(r.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              <pre className="text-xs bg-muted/50 rounded-lg p-2 overflow-auto max-h-32">
                {JSON.stringify(r.value, null, 2)}
              </pre>
            </div>
          ))}
          {filteredRules.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma regra encontrada</p>}
        </TabsContent>

        {/* APPROVALS TAB */}
        <TabsContent value="approvals" className="space-y-3">
          {approvals.map((a: any) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-bold text-foreground">Regra: {a.rule_id?.slice(0, 8)}</span>
                  </div>
                  {a.reason && <p className="text-xs text-muted-foreground mt-1">{a.reason}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="default" size="sm" onClick={() => resolveApproval(a.id, 'approved')}>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Aprovar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => resolveApproval(a.id, 'rejected')}>
                    <XCircle className="mr-1 h-3 w-3" /> Rejeitar
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {approvals.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma aprovação pendente</p>}
        </TabsContent>

        {/* DRIFTS TAB */}
        <TabsContent value="drifts" className="space-y-3">
          {drifts.map((d: any) => (
            <div key={d.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${d.severity === 'critical' ? 'text-red-500' : d.severity === 'high' ? 'text-orange-500' : 'text-yellow-500'}`} />
                    <Badge variant="outline">{d.type}</Badge>
                    <Badge variant="outline" className={d.severity === 'critical' ? 'border-red-500/50 text-red-500' : ''}>{d.severity}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{d.description}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(d.detected_at).toLocaleString('pt-BR')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => resolveDrift(d.id)}>
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Resolver
                </Button>
              </div>
            </div>
          ))}
          {drifts.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">✅ Nenhum drift detectado</p>}
        </TabsContent>

        {/* HEALTH TAB */}
        <TabsContent value="health" className="space-y-3">
          {health.map((h: any) => (
            <div key={h.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity className={`h-4 w-4 ${h.status === 'healthy' ? 'text-green-500' : h.status === 'degraded' ? 'text-yellow-500' : 'text-red-500'}`} />
                    <span className="text-sm font-bold text-foreground">{h.component_name}</span>
                    <Badge variant="outline" className={h.status === 'failing' ? 'border-red-500/50 text-red-500' : h.status === 'degraded' ? 'border-yellow-500/50 text-yellow-500' : ''}>{h.status}</Badge>
                  </div>
                  {h.last_error && <p className="text-xs text-muted-foreground mt-1 font-mono">{h.last_error}</p>}
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Falhas: {h.failure_count}</p>
                </div>
              </div>
            </div>
          ))}
          {health.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">✅ Todos os componentes saudáveis</p>}
        </TabsContent>
      </Tabs>

      {/* Create Rule Dialog */}
      <CreateRuleDialog open={showCreate} onOpenChange={setShowCreate} onCreated={fetchAll} />
    </AdminLayout>
  );
};

const CreateRuleDialog = ({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) => {
  const [form, setForm] = useState({ scope: 'global' as GovernanceScope, key: '', description: '', value: '{}' });

  const create = async () => {
    if (!form.key) { toast.error('Chave obrigatória'); return; }
    let parsed: any;
    try { parsed = JSON.parse(form.value); } catch { toast.error('JSON inválido'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from('governance_rules' as any) as any).insert({
      scope: form.scope,
      key: form.key,
      description: form.description,
      value: parsed,
      created_by: user?.id,
    });

    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Regra criada!');
    onOpenChange(false);
    setForm({ scope: 'global', key: '', description: '', value: '{}' });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Regra de Governança</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Scope</Label>
            <Select value={form.scope} onValueChange={(v) => setForm(p => ({ ...p, scope: v as GovernanceScope }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCOPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Chave</Label>
            <Input value={form.key} onChange={(e) => setForm(p => ({ ...p, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="ex: config_overrides" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Opcional" />
          </div>
          <div>
            <Label>Valor (JSON)</Label>
            <Textarea value={form.value} onChange={(e) => setForm(p => ({ ...p, value: e.target.value }))} rows={5} className="font-mono text-xs" />
          </div>
          <Button variant="accent" className="w-full" onClick={create}>
            <Plus className="mr-1 h-4 w-4" /> Criar Regra
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminGovernancePage;
