import { useState, useEffect } from 'react';
import IconRenderer from '@/components/ui/IconRenderer';
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
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Trophy, Zap, Plus, Save, Trash2, Edit2, Users, RefreshCw, Layers,
  Crown, Loader2, ChevronRight, Grid3x3, Sparkles, Check, X, Shield,
  ArrowRightLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import SmartAvatar from '@/components/ui/SmartAvatar';

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
  feature_unlocks: Record<string, boolean>;
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

interface TierRule {
  id: string;
  tier_key: string;
  tier_label: string;
  max_services: number;
  max_leads: number;
  max_ads: number;
  max_slots: number;
  ranking_priority: number;
  search_boost: number;
  radius_km: number;
  can_create_services: boolean;
  can_receive_leads: boolean;
  can_access_crm: boolean;
  can_access_reports: boolean;
  can_access_featured: boolean;
  can_view_client_phone: boolean;
  can_use_advanced_dashboard: boolean;
  top_search_placement: boolean;
  verified_badge: boolean;
}

interface Member {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  engagement_points: number;
  profile_type: string;
  created_at: string;
}

const cleanTierKey = (key: string): string => {
  if (!key) return '—';
  const map: Record<string, string> = {
    free_client: 'cliente',
    free_provider: 'profissional',
    free_rh: 'agencia_rh',
    premium: 'acesso_integral',
    sponsor: 'patrocinador',
  };
  return map[key] || key;
};

// ===== Matriz: definição de recursos exibidos no grid =====
const BOOL_RESOURCES: { key: keyof TierRule; label: string }[] = [
  { key: 'can_create_services',        label: 'Criar serviços' },
  { key: 'can_receive_leads',          label: 'Receber leads' },
  { key: 'can_access_crm',             label: 'Acesso ao CRM' },
  { key: 'can_access_reports',         label: 'Relatórios' },
  { key: 'can_access_featured',        label: 'Pode ser destaque' },
  { key: 'top_search_placement',       label: 'Top da busca' },
  { key: 'can_view_client_phone',      label: 'Ver telefone do cliente' },
  { key: 'can_use_advanced_dashboard', label: 'Dashboard avançado' },
];

const NUM_RESOURCES: { key: keyof TierRule; label: string; suffix?: string }[] = [
  { key: 'max_services',     label: 'Serviços' },
  { key: 'max_leads',        label: 'Leads/mês' },
  { key: 'max_ads',          label: 'Anúncios' },
  { key: 'max_slots',        label: 'Slots' },
  { key: 'radius_km',        label: 'Raio', suffix: 'km' },
  { key: 'search_boost',     label: 'Boost' },
  { key: 'ranking_priority', label: 'Prio.' },
];

// Ordem fixa dos perfis na matriz
const TIER_ORDER = ['free_client', 'free_provider', 'free_rh', 'sponsor', 'premium', 'other'];

const AdminGamificationPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { logAction } = useAuditLog();

  const [levels, setLevels] = useState<GamificationLevel[]>([]);
  const [rules, setRules] = useState<ScoreRule[]>([]);
  const [tiers, setTiers] = useState<TierRule[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [editingLevel, setEditingLevel] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const [membersOpen, setMembersOpen] = useState(false);
  const [membersLevel, setMembersLevel] = useState<GamificationLevel | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [migratingId, setMigratingId] = useState<string | null>(null);

  const fetchData = async () => {
    const [{ data: lvls }, { data: rls }, { data: trs }, { data: distRows }] = await Promise.all([
      supabase.from('gamification_levels').select('*').order('min_points'),
      supabase.from('score_rules').select('*').order('category, action_key'),
      supabase.from('tier_rules').select('*').order('tier_key'),
      supabase.rpc('admin_get_level_distribution'),
    ]);
    setLevels((lvls || []).map((l: any) => ({
      ...l,
      benefits: Array.isArray(l.benefits) ? l.benefits : [],
      feature_unlocks: l.feature_unlocks && typeof l.feature_unlocks === 'object' ? l.feature_unlocks : {},
    })));
    setRules((rls || []) as ScoreRule[]);
    // Ordena tiers pela ordem fixa
    const orderedTiers = ((trs || []) as TierRule[]).sort(
      (a, b) => (TIER_ORDER.indexOf(a.tier_key) + 99) - (TIER_ORDER.indexOf(b.tier_key) + 99)
    );
    setTiers(orderedTiers);
    const c: Record<string, number> = {};
    (distRows || []).forEach((r: any) => { c[r.level_id] = Number(r.user_count) || 0; });
    setCounts(c);
    setLoadingData(false);
  };

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin]);

  // ===== LEVELS =====
  const saveLevel = async (level: GamificationLevel) => {
    const payload = {
      name: level.name, icon: level.icon, color: level.color,
      min_points: level.min_points, max_points: level.max_points,
      priority: level.priority, benefits: level.benefits as any,
      badge_class: level.badge_class, active: level.active,
      feature_unlocks: level.feature_unlocks as any,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('gamification_levels').update(payload).eq('id', level.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(`Nível "${level.name}" atualizado`);
    logAction({ action: 'update', resource_type: 'gamification_level', resource_id: level.id, details: payload });
    setEditingLevel(null);
    fetchData();
  };

  const deleteLevel = async (id: string, name: string) => {
    if (!confirm(`Excluir nível "${name}"? Os usuários migrarão para o nível imediatamente inferior.`)) return;
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
      name: 'Novo Nível', icon: 'Star', color: '#6b7280',
      min_points: maxPoints + 1, priority: maxPriority + 10,
      badge_class: 'bg-muted text-muted-foreground',
    });
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Nível criado');
    fetchData();
  };

  const recalculateAll = async () => {
    if (!confirm('Recalcular pontos e níveis de TODOS os usuários? Pode levar alguns segundos.')) return;
    setRecalculating(true);
    const { data, error } = await supabase.rpc('admin_recalculate_all_engagement');
    setRecalculating(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    const row = (data as any)?.[0];
    toast.success(`Recálculo concluído: ${row?.processed_count ?? '—'} usuários processados`);
    fetchData();
  };

  const openMembers = async (level: GamificationLevel) => {
    setMembersLevel(level);
    setMembersOpen(true);
    setLoadingMembers(true);
    setMembers([]);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, engagement_points, profile_type, created_at')
      .eq('level_id', level.id)
      .order('engagement_points', { ascending: false })
      .limit(500);
    setLoadingMembers(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    setMembers((data || []) as Member[]);
  };

  const migrateMember = async (userId: string, newLevelId: string) => {
    setMigratingId(userId);
    const { error } = await supabase.rpc('admin_assign_user_level', {
      _user_id: userId, _level_id: newLevelId,
    });
    setMigratingId(null);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Usuário migrado de nível');
    setMembers(prev => prev.filter(m => m.id !== userId));
    fetchData();
  };

  // ===== RULES =====
  const saveRule = async (rule: ScoreRule) => {
    const payload = {
      label: rule.label, points: rule.points, description: rule.description,
      cooldown_hours: rule.cooldown_hours, max_per_day: rule.max_per_day,
      active: rule.active, category: rule.category,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('score_rules').update(payload).eq('id', rule.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(`Regra "${rule.label}" atualizada`);
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
      action_key: key, label: 'Nova Regra', points: 5, description: '', category: 'engagement',
    });
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Regra criada');
    fetchData();
  };

  // ===== TIERS =====
  const saveTier = async (t: TierRule) => {
    const payload = {
      tier_label: t.tier_label,
      max_services: t.max_services, max_leads: t.max_leads,
      max_ads: t.max_ads, max_slots: t.max_slots,
      radius_km: t.radius_km,
      ranking_priority: t.ranking_priority, search_boost: t.search_boost,
      can_create_services: t.can_create_services, can_receive_leads: t.can_receive_leads,
      can_access_crm: t.can_access_crm, can_access_reports: t.can_access_reports,
      can_access_featured: t.can_access_featured,
      can_view_client_phone: t.can_view_client_phone,
      can_use_advanced_dashboard: t.can_use_advanced_dashboard,
      top_search_placement: t.top_search_placement,
      verified_badge: t.verified_badge,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('tier_rules').update(payload).eq('id', t.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(`Tier "${t.tier_label}" atualizado`);
    logAction({ action: 'update', resource_type: 'tier_rule', resource_id: t.id, details: payload });
    setEditingTier(null);
    fetchData();
  };

  // ===== MATRIZ — toggle inline =====
  const toggleMatrixCell = async (tier: TierRule, key: keyof TierRule, value: boolean) => {
    const { error } = await supabase
      .from('tier_rules')
      .update({ [key]: value, updated_at: new Date().toISOString() } as any)
      .eq('id', tier.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    setTiers(prev => prev.map(t => t.id === tier.id ? { ...t, [key]: value } as TierRule : t));
    toast.success(`${tier.tier_label}: ${key} → ${value ? 'liberado' : 'bloqueado'}`);
    logAction({ action: 'update', resource_type: 'tier_rule', resource_id: tier.id, details: { matrix_toggle: { key, value } } });
  };

  const updateMatrixNumber = async (tier: TierRule, key: keyof TierRule, value: number) => {
    const { error } = await supabase
      .from('tier_rules')
      .update({ [key]: value, updated_at: new Date().toISOString() } as any)
      .eq('id', tier.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    setTiers(prev => prev.map(t => t.id === tier.id ? { ...t, [key]: value } as TierRule : t));
    logAction({ action: 'update', resource_type: 'tier_rule', resource_id: tier.id, details: { matrix_value: { key, value } } });
  };

  if (adminLoading || loadingData) {
    return <AdminLayout><div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div></AdminLayout>;
  }

  const ruleCategories = [...new Set(rules.map(r => r.category))];
  const totalUsers = Object.values(counts).reduce((s, n) => s + n, 0);
  const sponsorTier = tiers.find(t => t.tier_key === 'sponsor');

  return (
    <AdminLayout>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" /> Gamificação & Matriz de Recursos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Perfil base + bônus do nível · {totalUsers} usuários classificados
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={recalculateAll} disabled={recalculating} className="shrink-0">
          {recalculating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Recalcular pontos de todos
        </Button>
      </div>

      <Tabs defaultValue="matrix" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-5 max-w-3xl">
          <TabsTrigger value="matrix" className="flex items-center gap-1.5"><Grid3x3 className="h-3.5 w-3.5" /> Matriz</TabsTrigger>
          <TabsTrigger value="levels" className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Níveis</TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Regras</TabsTrigger>
          <TabsTrigger value="tiers" className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Perfis</TabsTrigger>
          <TabsTrigger value="sponsor" className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Patrocinador</TabsTrigger>
        </TabsList>

        {/* ===== MATRIZ ===== */}
        <TabsContent value="matrix">
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b bg-muted/30">
                <h2 className="text-sm font-semibold flex items-center gap-2"><Grid3x3 className="h-4 w-4" /> Matriz de Recursos × Perfis</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clique em qualquer célula para liberar/bloquear. Numéricos: <code>-1</code> = ilimitado · <code>0</code> = bloqueado.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      <th className="text-left p-2 font-semibold sticky left-0 bg-muted/40 min-w-[180px]">Recurso</th>
                      {tiers.map(t => (
                        <th key={t.id} className="p-2 text-center font-semibold whitespace-nowrap">
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{t.tier_label}</span>
                            <Badge variant="outline" className="font-mono text-[9px] font-normal">{cleanTierKey(t.tier_key)}</Badge>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {/* Booleanos */}
                    {BOOL_RESOURCES.map(r => (
                      <tr key={r.key} className="hover:bg-muted/20">
                        <td className="p-2 font-medium sticky left-0 bg-card">{r.label}</td>
                        {tiers.map(t => {
                          const v = (t as any)[r.key] as boolean;
                          return (
                            <td key={t.id} className="p-1.5 text-center">
                              <button
                                onClick={() => toggleMatrixCell(t, r.key, !v)}
                                className={`inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
                                  v ? 'bg-primary/15 text-primary hover:bg-primary/25'
                                    : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                                }`}
                                title={v ? 'Liberado — clique para bloquear' : 'Bloqueado — clique para liberar'}
                              >
                                {v ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Separador */}
                    <tr className="bg-muted/30">
                      <td colSpan={tiers.length + 1} className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Cotas e limites
                      </td>
                    </tr>
                    {/* Numéricos */}
                    {NUM_RESOURCES.map(r => (
                      <tr key={r.key} className="hover:bg-muted/20">
                        <td className="p-2 font-medium sticky left-0 bg-card">
                          {r.label}{r.suffix ? ` (${r.suffix})` : ''}
                        </td>
                        {tiers.map(t => {
                          const v = (t as any)[r.key] as number;
                          return (
                            <td key={t.id} className="p-1.5 text-center">
                              <Input
                                type="number"
                                defaultValue={v}
                                onBlur={(e) => {
                                  const newV = parseInt(e.target.value, 10);
                                  if (!Number.isNaN(newV) && newV !== v) updateMatrixNumber(t, r.key, newV);
                                }}
                                className="h-7 w-16 text-center px-1 mx-auto text-xs"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t bg-muted/20 text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Liberado</span>
                <span className="flex items-center gap-1"><X className="h-3 w-3 text-destructive" /> Bloqueado</span>
                <span className="ml-auto">Alterações aplicadas em produção via <code>effective_user_permissions</code>.</span>
              </div>
            </CardContent>
          </Card>

          {/* Bônus por nível */}
          <Card className="mt-4">
            <CardContent className="p-0">
              <div className="p-3 border-b bg-muted/30">
                <h2 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4" /> Bônus por Nível</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  O nível NÃO reduz permissões — apenas adiciona. Ex: Mestre desbloqueia "Selo verificado" mesmo se o perfil não tiver.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      <th className="text-left p-2 font-semibold sticky left-0 bg-muted/40 min-w-[180px]">Recurso desbloqueado</th>
                      {levels.map(l => (
                        <th key={l.id} className="p-2 text-center font-semibold whitespace-nowrap">
                          <div className="flex flex-col items-center gap-0.5">
                            <IconRenderer name={l.icon} size={14} style={{ color: l.color }} />
                            <span className="text-[11px]">{l.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {BOOL_RESOURCES.map(r => (
                      <tr key={r.key} className="hover:bg-muted/20">
                        <td className="p-2 font-medium sticky left-0 bg-card">{r.label}</td>
                        {levels.map(l => {
                          const v = !!l.feature_unlocks?.[r.key as string];
                          return (
                            <td key={l.id} className="p-1.5 text-center">
                              <button
                                onClick={async () => {
                                  const next = { ...l.feature_unlocks, [r.key]: !v };
                                  if (!next[r.key as string]) delete next[r.key as string];
                                  const { error } = await supabase
                                    .from('gamification_levels')
                                    .update({ feature_unlocks: next as any, updated_at: new Date().toISOString() })
                                    .eq('id', l.id);
                                  if (error) { toast.error(error.message); return; }
                                  setLevels(prev => prev.map(x => x.id === l.id ? { ...x, feature_unlocks: next } : x));
                                }}
                                className={`inline-flex items-center justify-center h-6 w-6 rounded-md transition-colors ${
                                  v ? 'bg-primary/15 text-primary hover:bg-primary/25'
                                    : 'bg-muted text-muted-foreground/40 hover:bg-muted/80'
                                }`}
                                title={v ? 'Desbloqueado neste nível' : 'Não desbloqueia'}
                              >
                                {v ? <Sparkles className="h-3.5 w-3.5" /> : <X className="h-3 w-3" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== LEVELS ===== */}
        <TabsContent value="levels">
          <div className="flex justify-end mb-3">
            <Button onClick={addLevel} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Nível</Button>
          </div>
          <div className="grid gap-2">
            {levels.map(level => {
              const isEditing = editingLevel === level.id;
              const userCount = counts[level.id] ?? 0;
              return (
                <Card key={level.id} className={`${!level.active ? 'opacity-50' : ''} border-l-4 transition-shadow hover:shadow-sm`} style={{ borderLeftColor: level.color }}>
                  <CardContent className="p-3.5">
                    {isEditing ? (
                      <LevelEditForm level={level} onSave={saveLevel} onCancel={() => setEditingLevel(null)} />
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${level.color}1a` }}>
                            <IconRenderer name={level.icon} size={20} style={{ color: level.color }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-foreground">{level.name}</span>
                              <Badge variant="outline" style={{ borderColor: level.color, color: level.color }}>
                                {level.min_points}{level.max_points ? `–${level.max_points}` : '+'} pts
                              </Badge>
                              <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> {userCount}</Badge>
                              {Object.keys(level.feature_unlocks || {}).length > 0 && (
                                <Badge variant="default" className="gap-1 text-[10px]">
                                  <Sparkles className="h-3 w-3" /> {Object.keys(level.feature_unlocks).length} bônus
                                </Badge>
                              )}
                              {!level.active && <Badge variant="secondary">Inativo</Badge>}
                            </div>
                            {level.benefits.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
                                {level.benefits.map((b, i) => <span key={i} className="bg-muted/60 rounded px-1.5 py-0.5">{String(b)}</span>)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => openMembers(level)} className="gap-1">
                            <Users className="h-3.5 w-3.5" /> Gerenciar Integrantes
                          </Button>
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

        {/* ===== RULES ===== */}
        <TabsContent value="rules">
          <div className="flex justify-end mb-3">
            <Button onClick={addRule} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Regra</Button>
          </div>
          {ruleCategories.map(cat => (
            <div key={cat} className="mb-5">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 capitalize">{cat}</h3>
              <div className="grid gap-1.5">
                {rules.filter(r => r.category === cat).map(rule => {
                  const isEditing = editingRule === rule.id;
                  return (
                    <Card key={rule.id} className={!rule.active ? 'opacity-50' : ''}>
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
                                {rule.max_per_day && <Badge variant="outline" className="text-[10px]">máx {rule.max_per_day}/dia</Badge>}
                                {rule.cooldown_hours && <Badge variant="outline" className="text-[10px]">cooldown {rule.cooldown_hours}h</Badge>}
                                {!rule.active && <Badge variant="secondary">Inativo</Badge>}
                              </div>
                              {rule.description && <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
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

        {/* ===== TIERS ===== */}
        <TabsContent value="tiers">
          <p className="text-xs text-muted-foreground mb-3">
            Edição detalhada de cada perfil. Para visão geral, use a aba "Matriz".
          </p>
          <div className="grid gap-2">
            {tiers.map(t => {
              const isEditing = editingTier === t.id;
              return (
                <Card key={t.id} className="border-l-4 border-l-accent/50">
                  <CardContent className="p-3.5">
                    {isEditing ? (
                      <TierEditForm tier={t} onSave={saveTier} onCancel={() => setEditingTier(null)} />
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground">{t.tier_label}</span>
                            <Badge variant="outline" className="font-mono text-[10px]">{cleanTierKey(t.tier_key)}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5 text-[11px]">
                            <span className="bg-muted/60 rounded px-1.5 py-0.5">Serviços: <b>{t.max_services}</b></span>
                            <span className="bg-muted/60 rounded px-1.5 py-0.5">Leads: <b>{t.max_leads}</b></span>
                            <span className="bg-muted/60 rounded px-1.5 py-0.5">Raio: <b>{t.radius_km}km</b></span>
                            <span className="bg-muted/60 rounded px-1.5 py-0.5">Boost: <b>{t.search_boost}</b></span>
                            {t.can_access_crm && <Badge variant="secondary" className="text-[10px]">CRM</Badge>}
                            {t.top_search_placement && <Badge variant="secondary" className="text-[10px]">Top busca</Badge>}
                            {t.can_view_client_phone && <Badge variant="secondary" className="text-[10px]">Tel cliente</Badge>}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setEditingTier(t.id)} className="shrink-0"><Edit2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ===== SPONSOR ===== */}
        <TabsContent value="sponsor">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold">Regras Exclusivas — Patrocinadores</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                O perfil <code>sponsor</code> sobrepõe a identidade comum: usuários vinculados via <code>sponsor_contacts</code>
                herdam essas permissões automaticamente.
              </p>
              {sponsorTier ? (
                <TierEditForm tier={sponsorTier} onSave={saveTier} onCancel={() => {}} alwaysOpen />
              ) : (
                <p className="text-sm text-destructive">Tier "sponsor" não encontrado.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Members Modal ===== */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {membersLevel && <IconRenderer name={membersLevel.icon} size={18} style={{ color: membersLevel.color }} />}
              Integrantes do nível "{membersLevel?.name}"
              <Badge variant="secondary" className="ml-auto">{members.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto -mx-6 px-6">
            {loadingMembers ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando integrantes…
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Nenhum usuário neste nível.</p>
            ) : (
              <ul className="divide-y divide-border">
                {members.map(m => (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <SmartAvatar src={m.avatar_url} name={m.full_name} className="h-9 w-9" fallbackClassName="text-xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.full_name || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email || '—'}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{m.profile_type}</Badge>
                    <Badge variant="default" className="text-xs gap-1"><Zap className="h-3 w-3" /> {m.engagement_points}</Badge>
                    {/* Migração manual */}
                    <Select
                      onValueChange={(newLevelId) => migrateMember(m.id, newLevelId)}
                      disabled={migratingId === m.id}
                    >
                      <SelectTrigger className="h-8 w-[150px] text-xs">
                        <span className="flex items-center gap-1.5">
                          {migratingId === m.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <ArrowRightLeft className="h-3 w-3" />}
                          <SelectValue placeholder="Migrar para…" />
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {levels.filter(l => l.id !== membersLevel?.id).map(l => (
                          <SelectItem key={l.id} value={l.id}>
                            <span className="flex items-center gap-1.5">
                              <IconRenderer name={l.icon} size={12} style={{ color: l.color }} />
                              {l.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <a
                      href={`/admin/usuarios?user=${m.id}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Ver no admin de usuários"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

// ===== Inline Forms =====
const LevelEditForm = ({ level, onSave, onCancel }: { level: GamificationLevel; onSave: (l: GamificationLevel) => void; onCancel: () => void }) => {
  const [form, setForm] = useState({ ...level });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const benefitsText = form.benefits.join('\n');
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label className="text-xs font-medium text-muted-foreground">Nome</label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            Ícone (Lucide) <IconRenderer name={form.icon} size={14} style={{ color: form.color }} />
          </label>
          <Input value={form.icon} onChange={e => set('icon', e.target.value)} placeholder="Crown, Gem, Star" />
        </div>
        <div><label className="text-xs font-medium text-muted-foreground">Cor</label><Input type="color" value={form.color} onChange={e => set('color', e.target.value)} className="h-9" /></div>
      </div>
      <div><label className="text-xs font-medium text-muted-foreground">Pontos Mín.</label><Input type="number" value={form.min_points} onChange={e => set('min_points', +e.target.value)} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Pontos Máx. (vazio = ∞)</label><Input type="number" value={form.max_points ?? ''} onChange={e => set('max_points', e.target.value ? +e.target.value : null)} /></div>
      <div className="col-span-full">
        <label className="text-xs font-medium text-muted-foreground">Benefícios (um por linha)</label>
        <Textarea value={benefitsText} rows={3} onChange={e => set('benefits', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} />
      </div>
      <div className="col-span-full flex items-center gap-2"><Switch checked={form.active} onCheckedChange={v => set('active', v)} /><span className="text-sm">Ativo</span></div>
      <div className="col-span-full flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={() => onSave(form)}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
      </div>
    </div>
  );
};

const RuleEditForm = ({ rule, onSave, onCancel }: { rule: ScoreRule; onSave: (r: ScoreRule) => void; onCancel: () => void }) => {
  const [form, setForm] = useState({ ...rule });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label className="text-xs font-medium text-muted-foreground">Nome</label><Input value={form.label} onChange={e => set('label', e.target.value)} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Pontos</label><Input type="number" value={form.points} onChange={e => set('points', +e.target.value)} /></div>
      <div className="col-span-full"><label className="text-xs font-medium text-muted-foreground">Descrição</label><Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={2} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Categoria</label><Input value={form.category} onChange={e => set('category', e.target.value)} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Máx/dia (vazio = sem limite)</label><Input type="number" value={form.max_per_day ?? ''} onChange={e => set('max_per_day', e.target.value ? +e.target.value : null)} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Cooldown (horas)</label><Input type="number" value={form.cooldown_hours ?? ''} onChange={e => set('cooldown_hours', e.target.value ? +e.target.value : null)} /></div>
      <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={v => set('active', v)} /><span className="text-sm">Ativo</span></div>
      <div className="col-span-full flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={() => onSave(form)}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
      </div>
    </div>
  );
};

const TierEditForm = ({
  tier, onSave, onCancel, alwaysOpen = false,
}: {
  tier: TierRule; onSave: (t: TierRule) => void; onCancel: () => void; alwaysOpen?: boolean;
}) => {
  const [form, setForm] = useState({ ...tier });
  useEffect(() => { setForm({ ...tier }); }, [tier]);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground">Rótulo</label><Input value={form.tier_label} onChange={e => set('tier_label', e.target.value)} /></div>
      <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground">Identificador</label><Input value={cleanTierKey(form.tier_key)} disabled className="font-mono text-xs" /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Máx Serviços</label><Input type="number" value={form.max_services} onChange={e => set('max_services', +e.target.value)} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Máx Leads</label><Input type="number" value={form.max_leads} onChange={e => set('max_leads', +e.target.value)} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Máx Anúncios</label><Input type="number" value={form.max_ads} onChange={e => set('max_ads', +e.target.value)} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Máx Slots</label><Input type="number" value={form.max_slots} onChange={e => set('max_slots', +e.target.value)} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Raio (km)</label><Input type="number" value={form.radius_km} onChange={e => set('radius_km', +e.target.value)} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Prioridade</label><Input type="number" value={form.ranking_priority} onChange={e => set('ranking_priority', +e.target.value)} /></div>
      <div><label className="text-xs font-medium text-muted-foreground">Boost Busca</label><Input type="number" value={form.search_boost} onChange={e => set('search_boost', +e.target.value)} /></div>
      <div className="col-span-full grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
        <label className="flex items-center gap-2 text-xs"><Switch checked={form.can_create_services} onCheckedChange={v => set('can_create_services', v)} /> Criar serviços</label>
        <label className="flex items-center gap-2 text-xs"><Switch checked={form.can_receive_leads} onCheckedChange={v => set('can_receive_leads', v)} /> Receber leads</label>
        <label className="flex items-center gap-2 text-xs"><Switch checked={form.can_access_crm} onCheckedChange={v => set('can_access_crm', v)} /> CRM</label>
        <label className="flex items-center gap-2 text-xs"><Switch checked={form.can_access_reports} onCheckedChange={v => set('can_access_reports', v)} /> Relatórios</label>
        <label className="flex items-center gap-2 text-xs"><Switch checked={form.can_access_featured} onCheckedChange={v => set('can_access_featured', v)} /> Destaque</label>
        <label className="flex items-center gap-2 text-xs"><Switch checked={form.top_search_placement} onCheckedChange={v => set('top_search_placement', v)} /> Top da busca</label>
        <label className="flex items-center gap-2 text-xs"><Switch checked={form.can_view_client_phone} onCheckedChange={v => set('can_view_client_phone', v)} /> Ver telefone</label>
        <label className="flex items-center gap-2 text-xs"><Switch checked={form.can_use_advanced_dashboard} onCheckedChange={v => set('can_use_advanced_dashboard', v)} /> Dashboard avançado</label>
      </div>
      <div className="col-span-full flex gap-2 justify-end">
        {!alwaysOpen && <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>}
        <Button size="sm" onClick={() => onSave(form)}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
      </div>
    </div>
  );
};

export default AdminGamificationPage;
