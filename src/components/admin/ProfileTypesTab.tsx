import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Check, X, Edit2, Plus, Trash2, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { logAuditAction } from '@/hooks/useAuditLog';

interface Capability {
  label: string;
  enabled: boolean;
}

interface ProfileType {
  id: string;
  profile_key: string;
  label: string;
  description: string;
  role: string;
  icon: string;
  color: string;
  tier_key: string;
  default_level_id: string | null;
  default_account_type_id: string | null;
  capabilities: Capability[];
  display_order: number;
  active: boolean;
}

const emptyForm = (): Omit<ProfileType, 'id'> => ({
  profile_key: '',
  label: '',
  description: '',
  role: 'client',
  icon: '👤',
  color: '#3b82f6',
  tier_key: '',
  default_level_id: null,
  default_account_type_id: null,
  capabilities: [],
  display_order: 0,
  active: true,
});

const ProfileTypesTab = () => {
  const [profileTypes, setProfileTypes] = useState<ProfileType[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tierRules, setTierRules] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [accountTypes, setAccountTypes] = useState<any[]>([]);

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [newCap, setNewCap] = useState('');

  const fetchAll = async () => {
    const [{ data: pts }, { data: profiles }, { data: tiers }, { data: lvls }, { data: ats }] = await Promise.all([
      supabase.from('profile_type_settings' as any).select('*').order('display_order'),
      supabase.from('profiles').select('profile_type'),
      supabase.from('tier_rules' as any).select('*').order('tier_key'),
      supabase.from('user_levels').select('id, name, color, priority').order('priority', { ascending: false }),
      supabase.from('account_types').select('id, name, color, price').order('display_order'),
    ]);
    setProfileTypes((pts as ProfileType[]) || []);
    setTierRules(tiers || []);
    setLevels(lvls || []);
    setAccountTypes(ats || []);

    const c: Record<string, number> = {};
    (profiles || []).forEach((p: any) => { c[p.profile_type] = (c[p.profile_type] || 0) + 1; });
    setCounts(c);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), display_order: profileTypes.length + 1 });
    setShowDialog(true);
  };

  const openEdit = (pt: ProfileType) => {
    setEditingId(pt.id);
    setForm({
      profile_key: pt.profile_key,
      label: pt.label,
      description: pt.description,
      role: pt.role,
      icon: pt.icon,
      color: pt.color,
      tier_key: pt.tier_key,
      default_level_id: pt.default_level_id,
      default_account_type_id: pt.default_account_type_id,
      capabilities: Array.isArray(pt.capabilities) ? pt.capabilities : [],
      display_order: pt.display_order,
      active: pt.active,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.profile_key.trim() || !form.label.trim()) {
      toast.error('Chave e label são obrigatórios');
      return;
    }
    setSaving(true);
    const payload = {
      profile_key: form.profile_key.trim(),
      label: form.label.trim(),
      description: form.description.trim(),
      role: form.role,
      icon: form.icon,
      color: form.color,
      tier_key: form.tier_key,
      default_level_id: form.default_level_id || null,
      default_account_type_id: form.default_account_type_id || null,
      capabilities: form.capabilities,
      display_order: form.display_order,
      active: form.active,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await (supabase.from('profile_type_settings' as any) as any).update(payload).eq('id', editingId);
      if (error) toast.error('Erro: ' + error.message);
      else { await logAuditAction({ action: 'update', resource_type: 'profile_type_settings', resource_id: editingId, details: payload }); toast.success('Tipo de cadastro atualizado!'); }
    } else {
      const { error } = await (supabase.from('profile_type_settings' as any) as any).insert(payload);
      if (error) toast.error('Erro: ' + error.message);
      else { await logAuditAction({ action: 'create', resource_type: 'profile_type_settings', details: payload }); toast.success('Tipo de cadastro criado!'); }
    }
    setSaving(false);
    setShowDialog(false);
    fetchAll();
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Excluir o tipo "${label}"? Isso NÃO remove usuários existentes.`)) return;
    const { error } = await (supabase.from('profile_type_settings' as any) as any).delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else { await logAuditAction({ action: 'delete', resource_type: 'profile_type_settings', resource_id: id }); toast.success('Excluído!'); fetchAll(); }
  };

  const addCapability = () => {
    if (!newCap.trim()) return;
    setForm(f => ({ ...f, capabilities: [...f.capabilities, { label: newCap.trim(), enabled: true }] }));
    setNewCap('');
  };

  const toggleCap = (idx: number) => {
    setForm(f => ({
      ...f,
      capabilities: f.capabilities.map((c, i) => i === idx ? { ...c, enabled: !c.enabled } : c),
    }));
  };

  const removeCap = (idx: number) => {
    setForm(f => ({ ...f, capabilities: f.capabilities.filter((_, i) => i !== idx) }));
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const getTier = (key: string) => tierRules.find((t: any) => t.tier_key === key);
  const getLevel = (id: string | null) => levels.find((l: any) => l.id === id);
  const getAccountType = (id: string | null) => accountTypes.find((a: any) => a.id === id);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {total} usuário(s) · {profileTypes.length} tipo(s) de cadastro
        </p>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Tipo</Button>
      </div>

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
        {profileTypes.map(pt => {
          const tier = getTier(pt.tier_key);
          const level = getLevel(pt.default_level_id);
          const acType = getAccountType(pt.default_account_type_id);
          const count = counts[pt.profile_key] || 0;
          const caps = Array.isArray(pt.capabilities) ? pt.capabilities : [];

          return (
            <Card key={pt.id} className={`relative overflow-hidden ${!pt.active ? 'opacity-50' : ''}`}>
              <div className="h-2" style={{ backgroundColor: pt.color }} />
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: pt.color + '20' }}>
                      {pt.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-foreground text-lg">{pt.label}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-mono">{pt.profile_key}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">role: {pt.role}</span>
                        {!pt.active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(pt)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(pt.id, pt.label)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-3">{pt.description}</p>

                {/* User count */}
                <div className="flex items-center gap-2 mb-3 bg-muted/40 rounded-lg px-3 py-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-bold text-foreground">{count}</span>
                  <span className="text-xs text-muted-foreground">usuário(s)</span>
                  <span className="text-xs text-muted-foreground ml-auto font-semibold">
                    {total > 0 ? Math.round((count / total) * 100) : 0}%
                  </span>
                </div>

                {/* Defaults */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-lg border border-border px-2 py-1.5">
                    <span className="text-[10px] text-muted-foreground block">Nível Padrão</span>
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                      {level && <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: level.color }} />}
                      {level?.name || '—'}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border px-2 py-1.5">
                    <span className="text-[10px] text-muted-foreground block">Plano Padrão</span>
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                      {acType && <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: acType.color }} />}
                      {acType?.name || '—'}
                    </span>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="mb-3">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Permissões</h4>
                  <div className="space-y-0.5">
                    {caps.map((cap, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        {cap.enabled
                          ? <Check className="h-3 w-3 text-green-500 shrink-0" />
                          : <X className="h-3 w-3 text-destructive/60 shrink-0" />}
                        <span className={cap.enabled ? 'text-foreground' : 'text-muted-foreground line-through'}>{cap.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tier rules */}
                {tier && (
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-1.5">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      Regra Tier <Badge variant="outline" className="text-[9px] font-mono ml-1">{tier.tier_key}</Badge>
                    </h4>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                      <div>Serviços: <strong className="text-foreground">{tier.max_services === -1 ? '∞' : tier.max_services}</strong></div>
                      <div>Leads: <strong className="text-foreground">{tier.max_leads === -1 ? '∞' : tier.max_leads}</strong></div>
                      <div>Criar: <Badge variant={tier.can_create_services ? 'default' : 'secondary'} className="text-[9px]">{tier.can_create_services ? 'Sim' : 'Não'}</Badge></div>
                      <div>Receber: <Badge variant={tier.can_receive_leads ? 'default' : 'secondary'} className="text-[9px]">{tier.can_receive_leads ? 'Sim' : 'Não'}</Badge></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Tipo de Cadastro' : 'Novo Tipo de Cadastro'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Ícone</Label>
                <Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="text-center text-lg" maxLength={4} />
              </div>
              <div className="col-span-3">
                <Label>Label *</Label>
                <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Profissional" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Chave (profile_key) *</Label>
                <Input value={form.profile_key} onChange={e => setForm(f => ({ ...f, profile_key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="ex: provider" disabled={!!editingId} />
              </div>
              <div>
                <Label>Role padrão</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">client</SelectItem>
                    <SelectItem value="provider">provider</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Cor</Label>
                <Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="h-10 p-1" />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" min={0} value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
                <Label>Ativo</Label>
              </div>
            </div>

            {/* Associations */}
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Associações Padrão</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Regra de Tier</Label>
                  <Select value={form.tier_key || '_none'} onValueChange={v => setForm(f => ({ ...f, tier_key: v === '_none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhuma</SelectItem>
                      {tierRules.map((t: any) => (
                        <SelectItem key={t.tier_key} value={t.tier_key}>{t.tier_label} ({t.tier_key})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nível Padrão</Label>
                  <Select value={form.default_level_id || '_none'} onValueChange={v => setForm(f => ({ ...f, default_level_id: v === '_none' ? null : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum</SelectItem>
                      {levels.map((l: any) => (
                        <SelectItem key={l.id} value={l.id}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                            {l.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Plano Padrão</Label>
                  <Select value={form.default_account_type_id || '_none'} onValueChange={v => setForm(f => ({ ...f, default_account_type_id: v === '_none' ? null : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum</SelectItem>
                      {accountTypes.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                            {a.name} (R$ {Number(a.price).toFixed(2)})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Capabilities */}
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Permissões / Recursos</h3>
              <div className="space-y-1.5 mb-3">
                {form.capabilities.map((cap, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                    <Switch checked={cap.enabled} onCheckedChange={() => toggleCap(idx)} />
                    <span className={`text-sm flex-1 ${cap.enabled ? 'text-foreground' : 'text-muted-foreground line-through'}`}>{cap.label}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeCap(idx)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newCap}
                  onChange={e => setNewCap(e.target.value)}
                  placeholder="Nova permissão (ex: Publicar vagas)"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCapability())}
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={addCapability} disabled={!newCap.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfileTypesTab;
