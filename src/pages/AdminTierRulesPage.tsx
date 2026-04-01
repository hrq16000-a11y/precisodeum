import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuditLog } from '@/hooks/useAuditLog';

interface TierRule {
  id: string;
  tier_key: string;
  tier_label: string;
  max_services: number;
  max_leads: number;
  can_create_services: boolean;
  can_receive_leads: boolean;
}

const AdminTierRulesPage = () => {
  const { isAdmin, loading } = useAdmin();
  const { logAction } = useAuditLog();
  const [rules, setRules] = useState<TierRule[]>([]);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newRule, setNewRule] = useState({ tier_key: '', tier_label: '', max_services: 0, max_leads: 0, can_create_services: false, can_receive_leads: false });

  const fetchRules = async () => {
    const { data } = await supabase.from('tier_rules' as any).select('*').order('tier_key');
    if (data) setRules(data as any);
    setFetching(false);
  };

  useEffect(() => {
    if (isAdmin) fetchRules();
  }, [isAdmin]);

  const handleSave = async (rule: TierRule) => {
    setSaving(rule.id);
    const { error } = await (supabase.from('tier_rules' as any) as any)
      .update({
        tier_label: rule.tier_label,
        max_services: rule.max_services,
        max_leads: rule.max_leads,
        can_create_services: rule.can_create_services,
        can_receive_leads: rule.can_receive_leads,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rule.id);
    setSaving(null);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success(`Tier "${rule.tier_label}" atualizado!`);
      logAction({ action: 'update', resource_type: 'tier_rules', resource_id: rule.id, details: { tier_key: rule.tier_key } });
    }
  };

  const handleCreate = async () => {
    if (!newRule.tier_key.trim()) { toast.error('Chave do tier é obrigatória'); return; }
    const { error } = await (supabase.from('tier_rules' as any) as any).insert({
      tier_key: newRule.tier_key.toLowerCase().replace(/\s+/g, '_'),
      tier_label: newRule.tier_label || newRule.tier_key,
      max_services: newRule.max_services,
      max_leads: newRule.max_leads,
      can_create_services: newRule.can_create_services,
      can_receive_leads: newRule.can_receive_leads,
    });
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Novo tier criado!');
      logAction({ action: 'create', resource_type: 'tier_rules', details: { tier_key: newRule.tier_key } });
      setShowNew(false);
      setNewRule({ tier_key: '', tier_label: '', max_services: 0, max_leads: 0, can_create_services: false, can_receive_leads: false });
      fetchRules();
    }
  };

  const handleDelete = async (rule: TierRule) => {
    if (!confirm(`Excluir tier "${rule.tier_label}"? Usuários desse tier perderão limites configurados.`)) return;
    const { error } = await (supabase.from('tier_rules' as any) as any).delete().eq('id', rule.id);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Tier excluído');
      logAction({ action: 'delete', resource_type: 'tier_rules', resource_id: rule.id, details: { tier_key: rule.tier_key } });
      fetchRules();
    }
  };

  const updateLocal = (id: string, field: keyof TierRule, value: any) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  if (loading || fetching) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded bg-muted" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Planos & Regras
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie limites e permissões por tier de conta. Alterações aplicam imediatamente.
            </p>
          </div>
          <Button onClick={() => setShowNew(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Tier
          </Button>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <strong>-1</strong> = ilimitado. <strong>0</strong> = nenhum acesso. Valores positivos definem o limite exato.
          </p>
        </div>

        <div className="grid gap-4">
          {rules.map(rule => (
            <Card key={rule.id} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {rule.tier_label}
                      <Badge variant="outline" className="text-[10px] font-mono">{rule.tier_key}</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {rule.max_services === -1 ? 'Serviços ilimitados' : `${rule.max_services} serviço(s)`}
                      {' · '}
                      {rule.max_leads === -1 ? 'Leads ilimitados' : `${rule.max_leads} lead(s)`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => handleSave(rule)} disabled={saving === rule.id}>
                      <Save className="h-3.5 w-3.5 mr-1" /> {saving === rule.id ? 'Salvando...' : 'Salvar'}
                    </Button>
                    {!['premium', 'free_provider', 'free_client', 'free_rh', 'other'].includes(rule.tier_key) && (
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(rule)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs">Nome do tier</Label>
                    <Input
                      value={rule.tier_label}
                      onChange={e => updateLocal(rule.id, 'tier_label', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Máx. Serviços</Label>
                    <Input
                      type="number"
                      value={rule.max_services}
                      onChange={e => updateLocal(rule.id, 'max_services', parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Máx. Leads</Label>
                    <Input
                      type="number"
                      value={rule.max_leads}
                      onChange={e => updateLocal(rule.id, 'max_leads', parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.can_create_services}
                        onCheckedChange={v => updateLocal(rule.id, 'can_create_services', v)}
                      />
                      <Label className="text-xs">Criar serviços</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.can_receive_leads}
                        onCheckedChange={v => updateLocal(rule.id, 'can_receive_leads', v)}
                      />
                      <Label className="text-xs">Receber leads</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* New Tier Dialog */}
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Tier</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Chave (ex: enterprise)</Label>
                <Input value={newRule.tier_key} onChange={e => setNewRule(n => ({ ...n, tier_key: e.target.value }))} placeholder="chave_unica" />
              </div>
              <div>
                <Label>Nome de exibição</Label>
                <Input value={newRule.tier_label} onChange={e => setNewRule(n => ({ ...n, tier_label: e.target.value }))} placeholder="Enterprise" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Máx. Serviços</Label>
                  <Input type="number" value={newRule.max_services} onChange={e => setNewRule(n => ({ ...n, max_services: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Máx. Leads</Label>
                  <Input type="number" value={newRule.max_leads} onChange={e => setNewRule(n => ({ ...n, max_leads: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={newRule.can_create_services} onCheckedChange={v => setNewRule(n => ({ ...n, can_create_services: v }))} />
                  <Label className="text-xs">Criar serviços</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newRule.can_receive_leads} onCheckedChange={v => setNewRule(n => ({ ...n, can_receive_leads: v }))} />
                  <Label className="text-xs">Receber leads</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-1" /> Criar Tier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminTierRulesPage;
