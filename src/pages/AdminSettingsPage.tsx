import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, Save, Plus, Trash2, X, Crown, FolderSync, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import ImageUploadField from '@/components/ImageUploadField';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AdminSettingsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [settings, setSettings] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newSetting, setNewSetting] = useState({ key: '', label: '', description: '', value: '', type: 'text' });
  const [search, setSearch] = useState('');

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('site_settings' as any)
      .select('*')
      .order('key');
    if (data) setSettings(data);
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchSettings();
  }, [isAdmin]);

  const toggleSetting = async (key: string, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    const { error } = await (supabase
      .from('site_settings' as any) as any)
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq('key', key);
    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      toast.success('Configuração atualizada!');
      fetchSettings();
    }
  };

  const updateTextSetting = async (key: string, newValue: string) => {
    const { error } = await (supabase
      .from('site_settings' as any) as any)
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq('key', key);
    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      toast.success('Configuração atualizada!');
      fetchSettings();
    }
  };

  const deleteSetting = async (key: string) => {
    if (!confirm(`Excluir a configuração "${key}"?`)) return;
    const { error } = await (supabase.from('site_settings' as any) as any).delete().eq('key', key);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Excluída!'); fetchSettings(); }
  };

  const createSetting = async () => {
    if (!newSetting.key || !newSetting.label) { toast.error('Chave e label são obrigatórios'); return; }
    const value = newSetting.type === 'boolean' ? 'false' : newSetting.value || '';
    const { error } = await (supabase.from('site_settings' as any) as any).insert({
      key: newSetting.key,
      label: newSetting.label,
      description: newSetting.description,
      value,
      is_public: false,
    });
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success('Configuração criada!');
      setShowCreate(false);
      setNewSetting({ key: '', label: '', description: '', value: '', type: 'text' });
      fetchSettings();
    }
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  const filtered = settings.filter((s: any) =>
    !search || s.key.includes(search.toLowerCase()) || s.label?.toLowerCase().includes(search.toLowerCase())
  );

  const booleanSettings = filtered.filter((s: any) => s.value === 'true' || s.value === 'false');
  const textSettings = filtered.filter((s: any) => s.value !== 'true' && s.value !== 'false');

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6" /> Configurações do Site
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {settings.length} configurações · {booleanSettings.length} flags · {textSettings.length} textos
          </p>
        </div>
        <Button variant="accent" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nova Configuração
        </Button>
      </div>

      <Input
        placeholder="Buscar por chave ou label..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-4 max-w-sm"
      />

      {/* 'Selo Verificado' removed — destaque agora é exclusivamente o Ranking de Gamificação (vide /admin/rankings) */}

      {/* ====== Regras de Perfil / DESTAQUE Section ====== */}
      <ProfileRulesSection settings={settings} onToggle={toggleSetting} onSaveText={updateTextSetting} />

      {/* Boolean / Flags */}
      <h2 className="mt-6 font-display text-lg font-bold text-foreground">Feature Flags ({booleanSettings.length})</h2>
      <div className="mt-3 space-y-2">
        {booleanSettings.map((s: any) => (
          <div key={s.key} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex-1 min-w-0 mr-4">
              <h3 className="text-sm font-bold text-foreground">{s.label}</h3>
              <p className="text-xs text-muted-foreground">{s.description}</p>
              <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{s.key}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={s.value === 'true'} onCheckedChange={() => toggleSetting(s.key, s.value)} />
              <Button variant="ghost" size="sm" onClick={() => deleteSetting(s.key)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Text / Image settings */}
      {textSettings.length > 0 && (
        <>
          <h2 className="mt-8 font-display text-lg font-bold text-foreground">Textos e Imagens ({textSettings.length})</h2>
          <div className="mt-3 space-y-3">
            {textSettings.map((s: any) => (
              <TextSettingRow key={s.key} setting={s} onSave={updateTextSetting} onDelete={deleteSetting} />
            ))}
          </div>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Configuração</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Tipo</Label>
              <Select value={newSetting.type} onValueChange={(v) => setNewSetting(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boolean">Flag (true/false)</SelectItem>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="image">Imagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chave (snake_case)</Label>
              <Input value={newSetting.key} onChange={(e) => setNewSetting(p => ({ ...p, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="ex: module_chat" />
            </div>
            <div>
              <Label>Label</Label>
              <Input value={newSetting.label} onChange={(e) => setNewSetting(p => ({ ...p, label: e.target.value }))} placeholder="ex: Módulo de Chat" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={newSetting.description} onChange={(e) => setNewSetting(p => ({ ...p, description: e.target.value }))} placeholder="Opcional" />
            </div>
            {newSetting.type === 'text' && (
              <div>
                <Label>Valor inicial</Label>
                <Input value={newSetting.value} onChange={(e) => setNewSetting(p => ({ ...p, value: e.target.value }))} />
              </div>
            )}
            <Button variant="accent" className="w-full" onClick={createSetting}>
              <Plus className="mr-1 h-4 w-4" /> Criar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

const TextSettingRow = ({ setting, onSave, onDelete }: { setting: any; onSave: (key: string, value: string) => Promise<void>; onDelete: (key: string) => Promise<void> }) => {
  const [value, setValue] = useState(setting.value);
  const changed = value !== setting.value;
  const isImageSetting = setting.key.includes('logo') || setting.key.includes('image') || setting.key.includes('banner') || setting.key.includes('icon');

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">{setting.label}</h3>
          <p className="text-xs text-muted-foreground">{setting.description}</p>
          <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{setting.key}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onDelete(setting.key)}>
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
      {isImageSetting ? (
        <ImageUploadField
          value={value}
          onChange={(url) => { setValue(url); onSave(setting.key, url); }}
          bucket="service-images"
          folder="settings"
          label=""
          placeholder="https://exemplo.com/logo.png"
        />
      ) : (
        <div className="flex gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} className="flex-1" />
          {changed && (
            <Button variant="accent" size="sm" onClick={() => onSave(setting.key, value)}>
              <Save className="mr-1 h-3 w-3" /> Salvar
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

/* 'VerifiedBadgeSection' removed — sistema de selo agora é regido pelo Ranking de Gamificação (vide /admin/rankings). */

export default AdminSettingsPage;

/* ====== Regras de Perfil / DESTAQUE — Painel Agrupado ====== */
const PROFILE_RULE_KEYS = [
  { key: 'destaque_require_avatar', label: 'DESTAQUE: Exigir avatar', type: 'boolean' },
  { key: 'destaque_require_portfolio', label: 'DESTAQUE: Exigir portfólio', type: 'boolean' },
  { key: 'destaque_require_services', label: 'DESTAQUE: Exigir serviços', type: 'boolean' },
  { key: 'destaque_require_description', label: 'DESTAQUE: Exigir descrição', type: 'boolean' },
  { key: 'destaque_min_services', label: 'DESTAQUE: Mín. serviços', type: 'number' },
  { key: 'destaque_min_portfolio', label: 'DESTAQUE: Mín. álbuns', type: 'number' },
  { key: 'incomplete_profile_hide_public', label: 'Ocultar perfis incompletos', type: 'boolean' },
  { key: 'incomplete_profile_auto_delete', label: 'Exclusão automática', type: 'boolean' },
  { key: 'incomplete_profile_days_limit', label: 'Prazo (dias)', type: 'number' },
  { key: 'avatar_fallback_style', label: 'Estilo avatar gerado', type: 'select', options: ['adventurer', 'bottts', 'fun-emoji', 'thumbs', 'lorelei', 'avataaars', 'big-ears'] },
];

const ProfileRulesSection = ({ settings, onToggle, onSaveText }: {
  settings: any[];
  onToggle: (key: string, currentValue: string) => Promise<void>;
  onSaveText: (key: string, value: string) => Promise<void>;
}) => {
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const map = useMemo(() => {
    const m: Record<string, string> = {};
    settings.forEach((s: any) => { m[s.key] = s.value; });
    return m;
  }, [settings]);

  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const init: Record<string, string> = {};
    PROFILE_RULE_KEYS.forEach(b => {
      if (b.type === 'number' || b.type === 'select') init[b.key] = map[b.key] || '';
    });
    setLocalValues(init);
  }, [map]);

  const avatarStyle = localValues['avatar_fallback_style'] || map['avatar_fallback_style'] || 'adventurer';
  const previewUrl = `https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=preview123`;

  return (
    <div className="mt-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
      <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2 mb-2">
        <Crown className="h-5 w-5 text-accent" /> Regras de Perfil e Selo DESTAQUE
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Configure os critérios para o selo DESTAQUE, política de perfis incompletos e estilo de avatar automático.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PROFILE_RULE_KEYS.map(({ key, label, type, options }) => {
          const val = map[key];
          if (type === 'boolean') {
            return (
              <div key={key} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <Switch checked={val === 'true'} onCheckedChange={() => onToggle(key, val || 'false')} />
              </div>
            );
          }
          if (type === 'select' && options) {
            return (
              <div key={key} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <span className="text-sm font-medium text-foreground flex-1">{label}</span>
                <Select value={localValues[key] || val || ''} onValueChange={(v) => { setLocalValues(p => ({ ...p, [key]: v })); onSaveText(key, v); }}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            );
          }
          return (
            <div key={key} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <span className="text-sm font-medium text-foreground flex-1">{label}</span>
              <Input
                type="number"
                min={0}
                className="w-20 text-center"
                value={localValues[key] ?? val ?? '0'}
                onChange={(e) => setLocalValues(p => ({ ...p, [key]: e.target.value }))}
              />
              {(localValues[key] ?? '') !== (val ?? '') && (
                <Button variant="accent" size="sm" onClick={() => onSaveText(key, localValues[key])}>
                  <Save className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {/* Avatar preview */}
      <div className="mt-4 flex items-center gap-4 rounded-lg border border-border bg-card p-3">
        <img src={previewUrl} alt="Preview avatar" className="h-14 w-14 rounded-xl" />
        <div>
          <p className="text-sm font-medium text-foreground">Preview do avatar gerado</p>
          <p className="text-xs text-muted-foreground">Estilo: <strong>{avatarStyle}</strong> — Usado quando o profissional não tem foto própria</p>
        </div>
      </div>
      {/* Migration button */}
      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
          <FolderSync className="h-4 w-4 text-accent" /> Migração de Portfólio Legado
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Cria álbuns "Meus Trabalhos" para profissionais que têm fotos no storage mas nenhum álbum criado. Vincula fotos existentes ao sistema de álbuns.
        </p>
        {migrationResult && (
          <div className="mb-3 rounded-md border border-accent/30 bg-accent/5 p-3 text-xs">
            <p className="font-medium text-foreground">Resultado da migração:</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              <li>Profissionais com fotos: <strong>{migrationResult.totalUsersWithMedia}</strong></li>
              <li>Álbuns criados: <strong>{migrationResult.albumsCreated}</strong></li>
              <li>Fotos vinculadas: <strong>{migrationResult.photosLinked}</strong></li>
              <li>Providers atualizados: <strong>{migrationResult.providersUpdated}</strong></li>
            </ul>
            {migrationResult.errors?.length > 0 && (
              <p className="mt-1 text-destructive">{migrationResult.errors.length} erros</p>
            )}
          </div>
        )}
        <Button
          variant="accent"
          size="sm"
          disabled={migrating}
          onClick={async () => {
            setMigrating(true);
            setMigrationResult(null);
            try {
              const { data, error } = await supabase.functions.invoke('migrate-portfolio-albums', { method: 'POST' });
              if (error) throw error;
              setMigrationResult(data);
              toast.success(`Migração concluída: ${data.albumsCreated} álbuns, ${data.photosLinked} fotos`);
            } catch (e: any) {
              toast.error('Erro na migração: ' + e.message);
            } finally {
              setMigrating(false);
            }
          }}
        >
          {migrating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FolderSync className="mr-1 h-4 w-4" />}
          {migrating ? 'Migrando...' : 'Migrar Fotos Legadas'}
        </Button>
      </div>
    </div>
  );
};
