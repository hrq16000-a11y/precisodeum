import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Zap, Plus, Trash2, Save, Settings2 } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';

interface Boost {
  id: string;
  provider_id: string;
  start_at: string;
  end_at: string;
  boost_weight: number;
  is_active: boolean;
  created_at: string;
  provider_name?: string;
}

const AdminBoostsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [form, setForm] = useState({ provider_id: '', start_at: '', end_at: '', boost_weight: 1, is_active: true });
  const [saving, setSaving] = useState(false);

  // Ranking config
  const [boostMul, setBoostMul] = useState('20');
  const [fairnessPen, setFairnessPen] = useState('5');
  const [randomFactor, setRandomFactor] = useState('5');

  const fetchBoosts = async () => {
    const { data } = await supabase
      .from('provider_boosts' as any)
      .select('*')
      .order('created_at', { ascending: false });
    const rows = (data || []) as any[];
    if (rows.length === 0) { setBoosts([]); return; }

    const provIds = [...new Set(rows.map(b => b.provider_id))];
    const { data: provs } = await supabase
      .from('providers')
      .select('id, business_name, slug')
      .in('id', provIds);
    const provMap = new Map((provs || []).map(p => [p.id, p.business_name || p.slug || p.id]));

    setBoosts(rows.map(b => ({ ...b, provider_name: provMap.get(b.provider_id) || b.provider_id })));
  };

  const fetchProviders = async () => {
    const { data } = await supabase
      .from('providers')
      .select('id, business_name, slug')
      .eq('status', 'approved')
      .is('deleted_at', null)
      .order('business_name');
    setProviders(data || []);
  };

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['ranking_boost_multiplier', 'ranking_fairness_penalty', 'ranking_random_factor']);
    (data || []).forEach((s: any) => {
      if (s.key === 'ranking_boost_multiplier') setBoostMul(s.value);
      if (s.key === 'ranking_fairness_penalty') setFairnessPen(s.value);
      if (s.key === 'ranking_random_factor') setRandomFactor(s.value);
    });
  };

  useEffect(() => {
    if (isAdmin) {
      fetchBoosts();
      fetchProviders();
      fetchConfig();
    }
  }, [isAdmin]);

  const handleCreate = async () => {
    if (!form.provider_id || !form.end_at) { toast.error('Selecione prestador e data final'); return; }
    setSaving(true);
    const { error } = await supabase.from('provider_boosts' as any).insert({
      provider_id: form.provider_id,
      start_at: form.start_at || new Date().toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      boost_weight: form.boost_weight,
      is_active: form.is_active,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Boost criado!');
    await logAuditAction({ action: 'create', resource_type: 'provider_boost', resource_id: form.provider_id });
    setDialogOpen(false);
    setForm({ provider_id: '', start_at: '', end_at: '', boost_weight: 1, is_active: true });
    fetchBoosts();
  };

  const toggleBoost = async (id: string, active: boolean) => {
    await supabase.from('provider_boosts' as any).update({ is_active: active } as any).eq('id', id);
    toast.success(active ? 'Boost ativado' : 'Boost desativado');
    fetchBoosts();
  };

  const deleteBoost = async (id: string) => {
    await supabase.from('provider_boosts' as any).delete().eq('id', id);
    toast.success('Boost removido');
    await logAuditAction({ action: 'delete', resource_type: 'provider_boost', resource_id: id });
    fetchBoosts();
  };

  const saveConfig = async () => {
    const updates = [
      { key: 'ranking_boost_multiplier', value: boostMul },
      { key: 'ranking_fairness_penalty', value: fairnessPen },
      { key: 'ranking_random_factor', value: randomFactor },
    ];
    for (const u of updates) {
      await supabase.from('site_settings').update({ value: u.value }).eq('key', u.key);
    }
    toast.success('Configuração de ranking salva!');
    await logAuditAction({ action: 'update', resource_type: 'ranking_config', details: { boostMul, fairnessPen, randomFactor } });
    setConfigOpen(false);
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  const now = new Date();

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" /> Boosts & Ranking
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{boosts.length} boost(s) cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1" /> Config Ranking
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Boost
          </Button>
        </div>
      </div>

      {/* Config summary */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Multiplicador Boost', value: boostMul + 'x' },
          { label: 'Penalidade Fairness', value: fairnessPen + 'x' },
          { label: 'Fator Aleatório', value: '0-' + randomFactor },
        ].map(c => (
          <Card key={c.label} className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-lg font-bold text-foreground">{c.value}</p>
          </Card>
        ))}
      </div>

      {/* Boosts list */}
      <div className="mt-4 space-y-3">
        {boosts.length === 0 && (
          <Card className="p-8 text-center">
            <Zap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-foreground font-semibold">Nenhum boost ativo</p>
            <p className="text-sm text-muted-foreground mt-1">Crie boosts para impulsionar profissionais no ranking</p>
          </Card>
        )}
        {boosts.map(b => {
          const isExpired = new Date(b.end_at) < now;
          const isActiveNow = b.is_active && !isExpired && new Date(b.start_at) <= now;
          return (
            <Card key={b.id} className={`p-4 ${isExpired ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isActiveNow ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">{b.provider_name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Peso: {b.boost_weight} • {new Date(b.start_at).toLocaleDateString()} → {new Date(b.end_at).toLocaleDateString()}
                      {isExpired && <span className="ml-1 text-destructive font-medium">Expirado</span>}
                      {isActiveNow && <span className="ml-1 text-amber-600 font-medium">Ativo</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={b.is_active} onCheckedChange={v => toggleBoost(b.id, v)} />
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteBoost(b.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo Boost</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Prestador</Label>
              <Select value={form.provider_id} onValueChange={v => setForm(f => ({ ...f, provider_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {providers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.business_name || p.slug || p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="date" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Peso do Boost (1-10)</Label>
              <Input type="number" min={1} max={10} value={form.boost_weight} onChange={e => setForm(f => ({ ...f, boost_weight: Number(e.target.value) || 1 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Salvando...' : 'Criar Boost'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Configuração do Ranking</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Multiplicador do Boost</Label>
              <p className="text-xs text-muted-foreground mb-1">Quanto maior, mais peso o boost pago tem no ranking</p>
              <Input type="number" min={1} max={100} value={boostMul} onChange={e => setBoostMul(e.target.value)} />
            </div>
            <div>
              <Label>Penalidade de Fairness</Label>
              <p className="text-xs text-muted-foreground mb-1">Quanto maior, mais quem já apareceu muito perde posição</p>
              <Input type="number" min={0} max={50} value={fairnessPen} onChange={e => setFairnessPen(e.target.value)} />
            </div>
            <div>
              <Label>Fator Aleatório</Label>
              <p className="text-xs text-muted-foreground mb-1">Variação máxima para evitar ranking estático (0 = desligado)</p>
              <Input type="number" min={0} max={20} value={randomFactor} onChange={e => setRandomFactor(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
            <Button onClick={saveConfig}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminBoostsPage;
