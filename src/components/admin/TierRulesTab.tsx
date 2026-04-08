import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Plus, Trash2, AlertTriangle } from 'lucide-react';
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

const TierRulesTab = () => {
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

  useEffect(() => { fetchRules(); }, []);

  const handleSave = async (rule: TierRule) => {
    setSaving(rule.id);
    const { error } = await (supabase.from('tier_rules' as any) as any)
      .update({ tier_label: rule.tier_label, max_services: rule.max_services, max_leads: rule.max_leads, can_create_services: rule.can_create_services, can_receive_leads: rule.can_receive_leads, updated_at: new Date().toISOString() })
      .eq('id', rule.id);
    setSaving(null);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(`Tier "${rule.tier_label}" atualizado!`); logAction({ action: 'update', resource_type: 'tier_rules', resource_id: rule.id, details: { tier_key: rule.tier_key } }); }
  };

  const handleCreate = async () => {
    if (!newRule.tier_key.trim()) { toast.error('Chave obrigatória'); return; }
    const { error } = await (supabase.from('tier_rules' as any) as any).insert({ tier_key: newRule.tier_key.toLowerCase().replace(/\s+/g, '_'), tier_label: newRule.tier_label || newRule.tier_key, max_services: newRule.max_services, max_leads: newRule.max_leads, can_create_services: newRule.can_create_services, can_receive_leads: newRule.can_receive_leads });
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Tier criado!'); setShowNew(false); setNewRule({ tier_key: '', tier_label: '', max_services: 0, max_leads: 0, can_create_services: false, can_receive_leads: false }); fetchRules(); }
  };

  const handleDelete = async (rule: TierRule) => {
    if (!confirm(`Excluir tier "${rule.tier_label}"?`)) return;
    const { error } = await (supabase.from('tier_rules' as any) as any).delete().eq('id', rule.id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Excluído'); fetchRules(); }
  };

  const updateLocal = (id: string, field: keyof TierRule, value: any) => setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  if (fetching) return <div className="h-40 animate-pulse rounded bg-muted" />;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="bg-muted/50 border border-border rounded-lg p-2 flex items-start gap-2 flex-1 mr-3">
          <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground"><strong>-1</strong> = ilimitado · <strong>0</strong> = nenhum</p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Tier</Button>
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
                    {rule.max_services === -1 ? 'Serviços ilimitados' : `${rule.max_services} serviço(s)`} · {rule.max_leads === -1 ? 'Leads ilimitados' : `${rule.max_leads} lead(s)`}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => handleSave(rule)} disabled={saving === rule.id}>
                    <Save className="h-3.5 w-3.5 mr-1" /> {saving === rule.id ? '...' : 'Salvar'}
                  </Button>
                  {!['premium', 'free_provider', 'free_client', 'free_rh', 'other'].includes(rule.tier_key) && (
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(rule)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><Label className="text-xs">Nome</Label><Input value={rule.tier_label} onChange={e => updateLocal(rule.id, 'tier_label', e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Máx. Serviços</Label><Input type="number" value={rule.max_services} onChange={e => updateLocal(rule.id, 'max_services', parseInt(e.target.value) || 0)} className="mt-1" /></div>
                <div><Label className="text-xs">Máx. Leads</Label><Input type="number" value={rule.max_leads} onChange={e => updateLocal(rule.id, 'max_leads', parseInt(e.target.value) || 0)} className="mt-1" /></div>
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2"><Switch checked={rule.can_create_services} onCheckedChange={v => updateLocal(rule.id, 'can_create_services', v)} /><Label className="text-xs">Criar serviços</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={rule.can_receive_leads} onCheckedChange={v => updateLocal(rule.id, 'can_receive_leads', v)} /><Label className="text-xs">Receber leads</Label></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Criar Novo Tier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Chave</Label><Input value={newRule.tier_key} onChange={e => setNewRule(n => ({ ...n, tier_key: e.target.value }))} placeholder="chave_unica" /></div>
            <div><Label>Nome</Label><Input value={newRule.tier_label} onChange={e => setNewRule(n => ({ ...n, tier_label: e.target.value }))} placeholder="Enterprise" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Máx. Serviços</Label><Input type="number" value={newRule.max_services} onChange={e => setNewRule(n => ({ ...n, max_services: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Máx. Leads</Label><Input type="number" value={newRule.max_leads} onChange={e => setNewRule(n => ({ ...n, max_leads: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><Switch checked={newRule.can_create_services} onCheckedChange={v => setNewRule(n => ({ ...n, can_create_services: v }))} /><Label className="text-xs">Criar serviços</Label></div>
              <div className="flex items-center gap-2"><Switch checked={newRule.can_receive_leads} onCheckedChange={v => setNewRule(n => ({ ...n, can_receive_leads: v }))} /><Label className="text-xs">Receber leads</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-1" /> Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TierRulesTab;
