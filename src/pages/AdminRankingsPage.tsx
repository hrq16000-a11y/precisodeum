import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, RefreshCw, Pencil, Save, X, Trophy, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface LevelRow {
  id: string;
  name: string;
  min_points: number;
  max_points: number | null;
  color: string;
  icon: string;
  badge_class: string;
  active: boolean;
  priority: number;
  benefits: any;
  user_count?: number;
}

interface ScoreRule {
  id: string;
  action_key: string;
  description: string | null;
  points: number;
  max_per_day: number | null;
  cooldown_hours: number | null;
  active: boolean;
}

const AdminRankingsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [rules, setRules] = useState<ScoreRule[]>([]);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [editingLevel, setEditingLevel] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [tempLevel, setTempLevel] = useState<Partial<LevelRow>>({});
  const [tempRule, setTempRule] = useState<Partial<ScoreRule>>({});
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);

  const loadData = async () => {
    const [distRes, rulesRes, profilesRes] = await Promise.all([
      (supabase.rpc as any)('admin_get_level_distribution'),
      supabase.from('score_rules').select('*').order('action_key'),
      supabase.from('profiles').select('engagement_points'),
    ]);

    if (distRes.data) {
      const levelIds = distRes.data.map((d: any) => d.level_id);
      const { data: fullLevels } = await supabase
        .from('gamification_levels')
        .select('*')
        .in('id', levelIds);
      const merged = (fullLevels || []).map((l: any) => {
        const d = distRes.data.find((x: any) => x.level_id === l.id);
        return { ...l, user_count: Number(d?.user_count || 0) };
      }).sort((a: any, b: any) => a.min_points - b.min_points);
      setLevels(merged);
    }
    if (rulesRes.data) setRules(rulesRes.data as any);
    if (profilesRes.data) {
      setTotalUsers(profilesRes.data.length);
      setTotalPoints(profilesRes.data.reduce((s: number, p: any) => s + (p.engagement_points || 0), 0));
    }
  };

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  const handleRecalculateAll = async () => {
    setRecalcLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('admin_recalculate_all_engagement');
      if (error) throw error;
      const result = (data?.[0] || {}) as { processed_count?: number; total_points?: number };
      toast.success(`Recálculo concluído: ${result.processed_count ?? 0} usuários · ${result.total_points ?? 0} pts`);
      await loadData();
    } catch (e: any) {
      toast.error('Erro ao recalcular: ' + (e.message || e));
    }
    setRecalcLoading(false);
  };

  const startEditLevel = (l: LevelRow) => {
    setEditingLevel(l.id);
    setTempLevel({ name: l.name, min_points: l.min_points, color: l.color });
  };

  const saveLevel = async (id: string) => {
    const { error } = await supabase
      .from('gamification_levels')
      .update(tempLevel as any)
      .eq('id', id);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success('Nível atualizado. Recalculando usuários...');
    setEditingLevel(null);
    await handleRecalculateAll();
  };

  const startEditRule = (r: ScoreRule) => {
    setEditingRule(r.id);
    setTempRule({ points: r.points, max_per_day: r.max_per_day, cooldown_hours: r.cooldown_hours });
  };

  const saveRule = async (id: string) => {
    const { error } = await supabase
      .from('score_rules')
      .update(tempRule as any)
      .eq('id', id);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success('Regra atualizada');
    setEditingRule(null);
    await loadData();
  };

  const toggleRule = async (id: string, active: boolean) => {
    await supabase.from('score_rules').update({ active: !active } as any).eq('id', id);
    await loadData();
  };

  if (loading) {
    return <AdminLayout><div className="animate-pulse h-96 bg-muted rounded-2xl" /></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400/30 to-purple-500/20 flex items-center justify-center">
              <Crown className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestão de Rankings</h1>
              <p className="text-sm text-muted-foreground">Distribuição por nível, regras de pontuação e ações de meritocracia</p>
            </div>
          </div>
          <Button onClick={handleRecalculateAll} disabled={recalcLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${recalcLoading ? 'animate-spin' : ''}`} />
            Recalcular pontos de todos
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            <div><div className="text-2xl font-bold text-foreground">{totalUsers}</div><div className="text-xs text-muted-foreground">Usuários</div></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-amber-500" />
            <div><div className="text-2xl font-bold text-foreground">{totalPoints.toLocaleString('pt-BR')}</div><div className="text-xs text-muted-foreground">Pontos totais</div></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-emerald-500" />
            <div><div className="text-2xl font-bold text-foreground">{totalUsers > 0 ? Math.round(totalPoints / totalUsers) : 0}</div><div className="text-xs text-muted-foreground">Média por usuário</div></div>
          </CardContent></Card>
        </div>

        {/* Distribuição por nível */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição de usuários por nível</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {levels.map((l, i) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-border p-4 bg-card hover:shadow-md transition-shadow"
                  style={{ borderTopColor: l.color, borderTopWidth: 3 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: l.color }}>{l.name}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEditLevel(l)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                  {editingLevel === l.id ? (
                    <div className="space-y-2">
                      <Input value={tempLevel.name as string} onChange={(e) => setTempLevel(s => ({ ...s, name: e.target.value }))} className="h-8 text-xs" placeholder="Nome" />
                      <Input type="number" value={tempLevel.min_points as number} onChange={(e) => setTempLevel(s => ({ ...s, min_points: Number(e.target.value) }))} className="h-8 text-xs" placeholder="Min pts" />
                      <Input value={tempLevel.color as string} onChange={(e) => setTempLevel(s => ({ ...s, color: e.target.value }))} className="h-8 text-xs" placeholder="#cor" />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 flex-1" onClick={() => saveLevel(l.id)}><Save className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" className="h-7" onClick={() => setEditingLevel(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-foreground">{l.user_count || 0}</div>
                      <div className="text-xs text-muted-foreground mt-1">A partir de {l.min_points} pts</div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Regras de pontuação */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regras de pontuação</CardTitle>
            <p className="text-xs text-muted-foreground">Ajuste pontos por ação. Mudanças não recalculam usuários antigos automaticamente.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Ação</th>
                    <th className="text-left py-2 px-2">Descrição</th>
                    <th className="text-right py-2 px-2">Pontos</th>
                    <th className="text-right py-2 px-2">Máx/dia</th>
                    <th className="text-right py-2 px-2">Cooldown (h)</th>
                    <th className="text-right py-2 px-2">Status</th>
                    <th className="text-right py-2 px-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(r => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2 font-mono text-xs text-foreground">{r.action_key}</td>
                      <td className="py-2 px-2 text-muted-foreground text-xs">{r.description || '—'}</td>
                      <td className="py-2 px-2 text-right">
                        {editingRule === r.id ? (
                          <Input type="number" value={tempRule.points as number} onChange={(e) => setTempRule(s => ({ ...s, points: Number(e.target.value) }))} className="h-7 w-16 text-xs ml-auto" />
                        ) : <span className="font-bold text-foreground">{r.points}</span>}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {editingRule === r.id ? (
                          <Input type="number" value={tempRule.max_per_day as number ?? ''} onChange={(e) => setTempRule(s => ({ ...s, max_per_day: e.target.value ? Number(e.target.value) : null }))} className="h-7 w-16 text-xs ml-auto" />
                        ) : <span className="text-muted-foreground">{r.max_per_day ?? '∞'}</span>}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {editingRule === r.id ? (
                          <Input type="number" value={tempRule.cooldown_hours as number ?? ''} onChange={(e) => setTempRule(s => ({ ...s, cooldown_hours: e.target.value ? Number(e.target.value) : null }))} className="h-7 w-16 text-xs ml-auto" />
                        ) : <span className="text-muted-foreground">{r.cooldown_hours ?? 0}</span>}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => toggleRule(r.id, r.active)} className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${r.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {r.active ? 'Ativa' : 'Inativa'}
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right">
                        {editingRule === r.id ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" className="h-7 w-7 p-0" onClick={() => saveRule(r.id)}><Save className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setEditingRule(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditRule(r)}><Pencil className="h-3 w-3" /></Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminRankingsPage;
