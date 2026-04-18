import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Zap, Plus, Save, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

interface GamificationLevel {
  id: string;
  name: string;
  icon: string;
  color: string;
  min_points: number;
  max_points: number | null;
  priority: number;
  benefits: string[];
  badge_class: string;
  active: boolean;
}

interface ScoreRule {
  id: string;
  action_key: string;
  label: string;
  points: number;
  description: string;
  cooldown_hours: number | null;
  max_per_day: number | null;
  active: boolean;
  category: string;
}

const AdminGamificationPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { logAction } = useAuditLog();

  const [levels, setLevels] = useState<GamificationLevel[]>([]);
  const [rules, setRules] = useState<ScoreRule[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [editingLevel, setEditingLevel] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);

  const fetchData = async () => {
    const [{ data: lvls }, { data: rls }] = await Promise.all([
      supabase.from('gamification_levels').select('*').order('min_points'),
      supabase.from('score_rules').select('*').order('category, action_key'),
    ]);
    setLevels((lvls || []).map((l: any) => ({ ...l, benefits: Array.isArray(l.benefits) ? l.benefits : [] })));
    setRules((rls || []) as ScoreRule[]);
    setLoadingData(false);
  };

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin]);

  // --- LEVELS ---
  const saveLevel = async (level: GamificationLevel) => {
    const payload = {
      name: level.name, icon: level.icon, color: level.color,
      min_points: level.min_points, max_points: level.max_points,
      priority: level.priority, benefits: level.benefits as any,
      badge_class: level.badge_class, active: level.active,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('gamification_levels').update(payload).eq('id', level.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(`Nível "${level.name}" atualizado!`);
    logAction({ action: 'update', resource_type: 'gamification_level', resource_id: level.id, details: payload });
    setEditingLevel(null);
    fetchData();
  };

  const deleteLevel = async (id: string, name: string) => {
    if (!confirm(`Excluir nível "${name}"?`)) return;
    const { error } = await supabase.from('gamification_levels').delete().eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Nível excluído');
    logAction({ action: 'delete', resource_type: 'gamification_level', resource_id: id });
    fetchData();
  };

  const addLevel = async () => {
    const maxPriority = Math.max(0, ...levels.map(l => l.priority));
    const maxPoints = Math.max(0, ...levels.map(l => l.max_points ?? l.min_points));
    const { error } = await supabase.from('gamification_levels').insert({
      name: 'Novo Nível', icon: '⭐', color: '#6b7280',
      min_points: maxPoints + 1, priority: maxPriority + 10,
      badge_class: 'bg-muted text-muted-foreground',
    });
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Nível criado!');
    fetchData();
  };

  // --- RULES ---
  const saveRule = async (rule: ScoreRule) => {
    const payload = {
      label: rule.label, points: rule.points, description: rule.description,
      cooldown_hours: rule.cooldown_hours, max_per_day: rule.max_per_day,
      active: rule.active, category: rule.category,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('score_rules').update(payload).eq('id', rule.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(`Regra "${rule.label}" atualizada!`);
    logAction({ action: 'update', resource_type: 'score_rule', resource_id: rule.id, details: payload });
    setEditingRule(null);
    fetchData();
  };

  const deleteRule = async (id: string, label: string) => {
    if (!confirm(`Excluir regra "${label}"?`)) return;
    const { error } = await supabase.from('score_rules').delete().eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Regra excluída');
    logAction({ action: 'delete', resource_type: 'score_rule', resource_id: id });
    fetchData();
  };

  const addRule = async () => {
    const key = `custom_${Date.now()}`;
    const { error } = await supabase.from('score_rules').insert({
      action_key: key, label: 'Nova Regra', points: 5,
      description: '', category: 'engagement',
    });
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Regra criada!');
    fetchData();
  };

  if (adminLoading || loadingData) return <AdminLayout><p className="text-muted-foreground p-6">Carregando...</p></AdminLayout>;

  const ruleCategories = [...new Set(rules.map(r => r.category))];

  return (
    <AdminLayout>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Gamificação
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gerencie níveis, pontuação e recompensas da comunidade</p>
      </div>

      <Tabs defaultValue="levels" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="levels" className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Níveis
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Regras de Pontuação
          </TabsTrigger>
        </TabsList>

        {/* ===== LEVELS TAB ===== */}
        <TabsContent value="levels">
          <div className="flex justify-end mb-4">
            <Button onClick={addLevel} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Nível</Button>
          </div>
          <div className="grid gap-3">
            {levels.map(level => {
              const isEditing = editingLevel === level.id;
              return (
                <Card key={level.id} className={`${!level.active ? 'opacity-50' : ''}`}>
                  <CardContent className="p-4">
                    {isEditing ? (
                      <LevelEditForm level={level} onSave={saveLevel} onCancel={() => setEditingLevel(null)} />
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <CategoryIcon icon={level.icon} size={24} className="text-foreground" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-foreground">{level.name}</span>
                              <Badge variant="outline" style={{ borderColor: level.color, color: level.color }}>{level.min_points}{level.max_points ? `–${level.max_points}` : '+'} pts</Badge>
                              {!level.active && <Badge variant="secondary">Inativo</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-1">
                              {level.benefits.map((b, i) => <span key={i} className="bg-muted/50 rounded px-1.5 py-0.5">{String(b)}</span>)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => setEditingLevel(level.id)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteLevel(level.id, level.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ===== RULES TAB ===== */}
        <TabsContent value="rules">
          <div className="flex justify-end mb-4">
            <Button onClick={addRule} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Regra</Button>
          </div>
          {ruleCategories.map(cat => (
            <div key={cat} className="mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 capitalize">{cat}</h3>
              <div className="grid gap-2">
                {rules.filter(r => r.category === cat).map(rule => {
                  const isEditing = editingRule === rule.id;
                  return (
                    <Card key={rule.id} className={`${!rule.active ? 'opacity-50' : ''}`}>
                      <CardContent className="p-3">
                        {isEditing ? (
                          <RuleEditForm rule={rule} onSave={saveRule} onCancel={() => setEditingRule(null)} />
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-foreground text-sm">{rule.label}</span>
                                <Badge variant={rule.points > 0 ? 'default' : 'destructive'} className="text-xs">
                                  {rule.points > 0 ? '+' : ''}{rule.points} pts
                                </Badge>
                                {!rule.active && <Badge variant="secondary">Inativo</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button variant="ghost" size="sm" onClick={() => setEditingRule(rule.id)}><Edit2 className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteRule(rule.id, rule.label)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

// --- Level Edit Inline Form ---
const LevelEditForm = ({ level, onSave, onCancel }: { level: GamificationLevel; onSave: (l: GamificationLevel) => void; onCancel: () => void }) => {
  const [form, setForm] = useState({ ...level });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Nome</label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Ícone</label>
          <Input value={form.icon} onChange={e => set('icon', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Cor</label>
          <Input type="color" value={form.color} onChange={e => set('color', e.target.value)} className="h-9" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Pontos Mín.</label>
        <Input type="number" value={form.min_points} onChange={e => set('min_points', +e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Pontos Máx. (vazio = ∞)</label>
        <Input type="number" value={form.max_points ?? ''} onChange={e => set('max_points', e.target.value ? +e.target.value : null)} />
      </div>
      <div className="col-span-full flex items-center gap-2">
        <Switch checked={form.active} onCheckedChange={v => set('active', v)} />
        <span className="text-sm">Ativo</span>
      </div>
      <div className="col-span-full flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={() => onSave(form)}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
      </div>
    </div>
  );
};

// --- Rule Edit Inline Form ---
const RuleEditForm = ({ rule, onSave, onCancel }: { rule: ScoreRule; onSave: (r: ScoreRule) => void; onCancel: () => void }) => {
  const [form, setForm] = useState({ ...rule });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Nome</label>
        <Input value={form.label} onChange={e => set('label', e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Pontos</label>
        <Input type="number" value={form.points} onChange={e => set('points', +e.target.value)} />
      </div>
      <div className="col-span-full">
        <label className="text-xs font-medium text-muted-foreground">Descrição</label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Categoria</label>
        <Input value={form.category} onChange={e => set('category', e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.active} onCheckedChange={v => set('active', v)} />
        <span className="text-sm">Ativo</span>
      </div>
      <div className="col-span-full flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={() => onSave(form)}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
      </div>
    </div>
  );
};

export default AdminGamificationPage;
