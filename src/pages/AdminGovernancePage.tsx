import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Shield, Plus, Save, Trash2, Search, RotateCcw,
  Palette, KeyRound, MapPin, Trophy, Settings2, HardDrive, Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Scope = 'auth' | 'ui' | 'ranking' | 'geo' | 'global' | 'storage' | 'sil';

const SCOPE_META: Record<Scope, { label: string; icon: any; color: string; desc: string }> = {
  auth:    { label: 'Autenticação',     icon: KeyRound,  color: 'text-blue-500',    desc: 'Acesso, módulos, login' },
  ui:      { label: 'Interface',        icon: Palette,   color: 'text-purple-500',  desc: 'Cores, layout, comportamento visual' },
  ranking: { label: 'Ranking & Pontos', icon: Trophy,    color: 'text-amber-500',   desc: 'Pesos, fatores, gamificação' },
  geo:     { label: 'Geolocalização',   icon: MapPin,    color: 'text-emerald-500', desc: 'Raios, regiões, distâncias' },
  global:  { label: 'Global',           icon: Settings2, color: 'text-slate-500',   desc: 'Parâmetros gerais do sistema' },
  storage: { label: 'Armazenamento',    icon: HardDrive, color: 'text-cyan-500',    desc: 'Cotas, mídia, backup' },
  sil:     { label: 'Sistema (SIL)',    icon: Wrench,    color: 'text-rose-500',    desc: 'Self-healing, integridade' },
};
const SCOPE_ORDER: Scope[] = ['auth', 'ui', 'ranking', 'geo', 'global', 'storage', 'sil'];

/** Convert "module_blog" → "Módulo de Blog" */
const humanize = (key: string): string => {
  const dict: Record<string, string> = {
    module: 'Módulo', auto: 'Auto', approve: 'Aprovação', providers: 'Prestadores',
    require: 'Exigir', cnpj: 'CNPJ', city: 'Cidade', photo: 'Foto', min: 'Mínimo',
    max: 'Máximo', services: 'Serviços', albums: 'Álbuns', reviews: 'Avaliações',
    rating: 'Nota', radius: 'Raio', km: '(km)', meters: '(m)', enabled: 'Ativado',
    threshold: 'Limite', weight: 'Peso', ranking: 'Ranking', score: 'Pontuação',
    sponsor: 'Patrocinador', sponsors: 'Patrocinadores', boost: 'Boost', ad: 'Anúncio',
    ads: 'Anúncios', blog: 'Blog', jobs: 'Vagas', courses: 'Cursos', chat: 'Chat',
    referrals: 'Indicações', notifications: 'Notificações', portfolio: 'Portfólio',
    leads: 'Leads', signup: 'Cadastro', login: 'Login', email: 'E-mail', phone: 'Telefone',
    google: 'Google', facebook: 'Facebook', whatsapp: 'WhatsApp', delay: 'Delay',
    duration: 'Duração', color: 'Cor', primary: 'Primária', secondary: 'Secundária',
    accent: 'Destaque', dark: 'Escuro', light: 'Claro', mode: 'Modo', theme: 'Tema',
    font: 'Fonte', size: 'Tamanho', cooldown: 'Cooldown', limit: 'Limite',
    nearby: 'Próximos', distance: 'Distância', state: 'Estado', country: 'País',
  };
  return key
    .split(/[_\s.-]+/)
    .filter(Boolean)
    .map(w => dict[w.toLowerCase()] || (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
};

/** Parse a governance rule's value (jsonb) into a logical type */
type ValueKind = 'boolean' | 'number' | 'string' | 'json';
const detectKind = (raw: any): ValueKind => {
  // raw comes from jsonb — could be primitive or {value: x}
  const v = raw?.value !== undefined ? raw.value : raw;
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v))) return 'number';
  if (typeof v === 'string' && (v === 'true' || v === 'false')) return 'boolean';
  if (typeof v === 'string') return 'string';
  return 'json';
};
const extractValue = (raw: any): any => (raw?.value !== undefined ? raw.value : raw);
const wrapValue = (raw: any, newVal: any): any =>
  raw && typeof raw === 'object' && !Array.isArray(raw) && raw.value !== undefined
    ? { ...raw, value: newVal }
    : newVal;

interface Rule {
  id: string;
  scope: Scope | string;
  key: string;
  description: string | null;
  value: any;
  status: string;
  version: number;
  updated_at: string;
}

const AdminGovernancePage = () => {
  const { isAdmin, loading } = useAdmin();
  const [rules, setRules] = useState<Rule[]>([]);
  const [activeScope, setActiveScope] = useState<Scope>('auth');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchRules = async () => {
    const { data, error } = await supabase
      .from('governance_rules' as any)
      .select('*')
      .order('scope')
      .order('key');
    if (error) { toast.error('Erro: ' + error.message); return; }
    setRules((data as any[]) as Rule[]);
  };

  useEffect(() => { if (isAdmin) fetchRules(); }, [isAdmin]);

  const grouped = useMemo(() => {
    const map: Record<string, Rule[]> = {};
    const safe = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : v == null ? '' : String(v).toLowerCase());
    const q = search.toLowerCase().trim();
    try {
      rules.forEach(r => {
        if (q && !safe(r.key).includes(q) && !safe(r.description).includes(q) && !safe(humanize(r.key)).includes(q)) return;
        const s = (r.scope as string) || 'global';
        (map[s] = map[s] || []).push(r);
      });
    } catch (err) {
      console.error('[Governance] filter error:', err);
    }
    return map;
  }, [rules, search]);

  const saveRule = async (id: string, newValue: any) => {
    setSavingId(id);
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    const wrapped = wrapValue(rule.value, newValue);
    const { error } = await (supabase.from('governance_rules' as any) as any)
      .update({ value: wrapped, version: (rule.version || 1) + 1 })
      .eq('id', id);
    setSavingId(null);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Regra atualizada');
    setRules(rs => rs.map(r => r.id === id ? { ...r, value: wrapped, version: r.version + 1 } : r));
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Excluir esta regra?')) return;
    await (supabase.from('governance_rules' as any) as any).delete().eq('id', id);
    toast.success('Regra excluída');
    fetchRules();
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  const scopeCount = (s: Scope) => grouped[s]?.length || 0;

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6" /> Configurações Globais
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CMS visual de regras de governança · {rules.length} regras carregadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar regra…"
              className="h-9 pl-7 w-56 text-xs"
            />
          </div>
          <Button variant="accent" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nova Regra
          </Button>
        </div>
      </div>

      <Tabs value={activeScope} onValueChange={(v) => setActiveScope(v as Scope)}>
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
          {SCOPE_ORDER.map(s => {
            const meta = SCOPE_META[s];
            const Icon = meta.icon;
            const count = scopeCount(s);
            return (
              <TabsTrigger key={s} value={s} className="data-[state=active]:bg-background gap-1.5 text-xs">
                <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                {meta.label}
                <Badge variant="outline" className="ml-1 h-4 min-w-[18px] px-1 text-[10px]">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {SCOPE_ORDER.map(s => {
          const meta = SCOPE_META[s];
          const Icon = meta.icon;
          const list = grouped[s] || [];
          return (
            <TabsContent key={s} value={s} className="mt-4 space-y-2">
              <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                <Icon className={`h-4 w-4 ${meta.color}`} />
                <span className="font-semibold">{meta.label}</span>
                <span>— {meta.desc}</span>
              </div>

              {list.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Nenhuma regra neste escopo {search ? `(filtro: "${search}")` : ''}
                </div>
              )}

              {list.map(r => (
                <RuleRow
                  key={r.id}
                  rule={r}
                  saving={savingId === r.id}
                  onSave={(v) => saveRule(r.id, v)}
                  onDelete={() => deleteRule(r.id)}
                />
              ))}
            </TabsContent>
          );
        })}
      </Tabs>

      <CreateRuleDialog open={showCreate} onOpenChange={setShowCreate} onCreated={fetchRules} />
    </AdminLayout>
  );
};

/* ─────────── Smart row — auto-detects type and renders correct input ─────────── */
const RuleRow = ({ rule, saving, onSave, onDelete }: {
  rule: Rule; saving: boolean; onSave: (v: any) => void; onDelete: () => void;
}) => {
  const original = extractValue(rule.value);
  const kind = detectKind(rule.value);
  const [draft, setDraft] = useState<any>(original);
  const [jsonText, setJsonText] = useState<string>(() =>
    kind === 'json' ? JSON.stringify(original, null, 2) : ''
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);

  const handleSave = () => {
    if (kind === 'json') {
      try {
        const parsed = JSON.parse(jsonText);
        onSave(parsed);
        setDraft(parsed);
      } catch {
        toast.error('JSON inválido');
      }
    } else if (kind === 'number') {
      onSave(Number(draft));
    } else if (kind === 'boolean') {
      onSave(Boolean(draft));
    } else {
      onSave(String(draft));
    }
  };

  const reset = () => {
    setDraft(original);
    if (kind === 'json') setJsonText(JSON.stringify(original, null, 2));
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4 hover:border-foreground/20 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-foreground">{humanize(rule.key)}</h3>
            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">{rule.key}</Badge>
            <Badge variant="outline" className="text-[10px]">{kind}</Badge>
            <span className="text-[10px] text-muted-foreground">v{rule.version}</span>
          </div>
          {rule.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {kind === 'boolean' && (
            <Switch checked={Boolean(draft)} onCheckedChange={(v) => setDraft(v)} />
          )}
          {kind === 'number' && (
            <Input
              type="number"
              value={draft ?? ''}
              onChange={(e) => setDraft(e.target.value === '' ? '' : Number(e.target.value))}
              className="h-8 w-28 text-xs"
            />
          )}
          {kind === 'string' && (
            <Input
              value={draft ?? ''}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 w-48 text-xs"
            />
          )}

          {dirty && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={reset} title="Desfazer">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            variant={dirty ? 'default' : 'ghost'}
            className="h-8"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onDelete} title="Excluir">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {kind === 'json' && (
        <Textarea
          value={jsonText}
          onChange={(e) => { setJsonText(e.target.value); try { setDraft(JSON.parse(e.target.value)); } catch { /* ignore */ } }}
          rows={4}
          className="mt-2 font-mono text-xs"
        />
      )}
    </div>
  );
};

/* ─────────── Create dialog ─────────── */
const CreateRuleDialog = ({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void;
}) => {
  const [form, setForm] = useState({ scope: 'global' as Scope, key: '', description: '', value: 'false', kind: 'boolean' as ValueKind });

  const create = async () => {
    if (!form.key) { toast.error('Chave obrigatória'); return; }
    let parsed: any;
    try {
      if (form.kind === 'boolean') parsed = form.value === 'true';
      else if (form.kind === 'number') parsed = Number(form.value);
      else if (form.kind === 'json') parsed = JSON.parse(form.value);
      else parsed = form.value;
    } catch { toast.error('Valor inválido'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from('governance_rules' as any) as any).insert({
      scope: form.scope, key: form.key, description: form.description,
      value: parsed, created_by: user?.id,
    });
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Regra criada!');
    onOpenChange(false);
    setForm({ scope: 'global', key: '', description: '', value: 'false', kind: 'boolean' });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Regra</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Escopo</Label>
              <Select value={form.scope} onValueChange={(v) => setForm(p => ({ ...p, scope: v as Scope }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCOPE_ORDER.map(s => <SelectItem key={s} value={s}>{SCOPE_META[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm(p => ({ ...p, kind: v as ValueKind, value: v === 'boolean' ? 'false' : v === 'number' ? '0' : v === 'json' ? '{}' : '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boolean">Toggle (true/false)</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="string">Texto</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Chave</Label>
            <Input value={form.key} onChange={(e) => setForm(p => ({ ...p, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="ex: module_blog" />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Valor</Label>
            {form.kind === 'json' ? (
              <Textarea value={form.value} onChange={(e) => setForm(p => ({ ...p, value: e.target.value }))} rows={4} className="font-mono text-xs" />
            ) : form.kind === 'boolean' ? (
              <Select value={form.value} onValueChange={(v) => setForm(p => ({ ...p, value: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">true (ativado)</SelectItem>
                  <SelectItem value="false">false (desativado)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input type={form.kind === 'number' ? 'number' : 'text'} value={form.value} onChange={(e) => setForm(p => ({ ...p, value: e.target.value }))} />
            )}
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
