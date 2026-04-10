import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, Save, Eye, Smartphone, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface NavConfig {
  id: string;
  is_active: boolean;
  layout_type: string;
  background_color: string;
  border_color: string;
  shadow: boolean;
  blur: boolean;
  height: number;
  padding: number;
  animation_type: string;
  animation_duration: number;
  mobile_only: boolean;
  hidden_paths: string[];
}

interface NavItem {
  id: string;
  config_id: string;
  label: string;
  icon: string;
  icon_active: string;
  route_path: string;
  external_url: string;
  action_type: string;
  order_index: number;
  is_active: boolean;
  badge: string;
  badge_color: string;
  text_color: string;
  active_color: string;
  background_color: string;
  border_radius: string;
  size: string;
  animation: string;
  requires_auth: boolean;
}

const POPULAR_ICONS = [
  'Home', 'Search', 'LayoutGrid', 'User', 'MessageCircle', 'Heart', 'Bell',
  'ShoppingCart', 'Settings', 'Menu', 'Plus', 'Star', 'Briefcase', 'MapPin',
  'Phone', 'Mail', 'Camera', 'Bookmark', 'Share2', 'Compass',
];

const DEFAULT_HIDDEN = ['/admin', '/login', '/cadastro', '/reset-password', '/dashboard', '/sponsor-panel'];

const AdminBottomNavPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const queryClient = useQueryClient();

  // ── Fetch config ──
  const { data: configData } = useQuery({
    queryKey: ['admin-bottom-nav-config'],
    queryFn: async () => {
      const { data } = await supabase.from('ui_bottom_nav_config').select('*').order('created_at', { ascending: false }).limit(1);
      return (data && data.length > 0 ? data[0] : null) as NavConfig | null;
    },
  });

  // ── Fetch items ──
  const { data: itemsData } = useQuery({
    queryKey: ['admin-bottom-nav-items', configData?.id],
    queryFn: async () => {
      if (!configData?.id) return [];
      const { data } = await supabase.from('ui_bottom_nav_items').select('*').eq('config_id', configData.id).order('order_index');
      return (data || []) as NavItem[];
    },
    enabled: !!configData?.id,
  });

  const [config, setConfig] = useState<NavConfig | null>(null);
  const [items, setItems] = useState<NavItem[]>([]);
  const [editItem, setEditItem] = useState<NavItem | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (configData) setConfig({ ...configData, hidden_paths: Array.isArray(configData.hidden_paths) ? configData.hidden_paths : DEFAULT_HIDDEN });
  }, [configData]);

  useEffect(() => {
    if (itemsData) setItems(itemsData);
  }, [itemsData]);

  // ── Create config if none exists ──
  const createConfig = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('ui_bottom_nav_config').insert({
        is_active: false,
        hidden_paths: DEFAULT_HIDDEN,
      } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bottom-nav-config'] });
      toast.success('Configuração criada');
    },
  });

  // ── Save config ──
  const saveConfig = useMutation({
    mutationFn: async (c: NavConfig) => {
      const { error } = await supabase.from('ui_bottom_nav_config').update({
        is_active: c.is_active,
        layout_type: c.layout_type,
        background_color: c.background_color,
        border_color: c.border_color,
        shadow: c.shadow,
        blur: c.blur,
        height: c.height,
        padding: c.padding,
        animation_type: c.animation_type,
        animation_duration: c.animation_duration,
        mobile_only: c.mobile_only,
        hidden_paths: c.hidden_paths as any,
      } as any).eq('id', c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bottom-nav-config'] });
      queryClient.invalidateQueries({ queryKey: ['bottom-nav-config'] });
      toast.success('Configuração salva');
    },
  });

  // ── Save item ──
  const saveItem = useMutation({
    mutationFn: async (item: Partial<NavItem> & { config_id: string }) => {
      if (item.id) {
        const { error } = await supabase.from('ui_bottom_nav_items').update(item as any).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ui_bottom_nav_items').insert(item as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bottom-nav-items'] });
      queryClient.invalidateQueries({ queryKey: ['bottom-nav-config'] });
      setShowDialog(false);
      setEditItem(null);
      toast.success('Botão salvo');
    },
  });

  // ── Delete item ──
  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ui_bottom_nav_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bottom-nav-items'] });
      queryClient.invalidateQueries({ queryKey: ['bottom-nav-config'] });
      toast.success('Botão removido');
    },
  });

  // ── Reorder ──
  const moveItem = async (idx: number, dir: -1 | 1) => {
    const newItems = [...items];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;
    [newItems[idx], newItems[targetIdx]] = [newItems[targetIdx], newItems[idx]];
    const updates = newItems.map((it, i) => ({ id: it.id, order_index: i }));
    for (const u of updates) {
      await supabase.from('ui_bottom_nav_items').update({ order_index: u.order_index } as any).eq('id', u.id);
    }
    queryClient.invalidateQueries({ queryKey: ['admin-bottom-nav-items'] });
    queryClient.invalidateQueries({ queryKey: ['bottom-nav-config'] });
  };

  const openNewItem = () => {
    if (!config) return;
    setEditItem({
      id: '',
      config_id: config.id,
      label: '',
      icon: 'Home',
      icon_active: '',
      route_path: '/',
      external_url: '',
      action_type: 'route',
      order_index: items.length,
      is_active: true,
      badge: '',
      badge_color: '',
      text_color: '',
      active_color: '',
      background_color: '',
      border_radius: '',
      size: 'medium',
      animation: 'scale',
      requires_auth: false,
    });
    setShowDialog(true);
  };

  if (adminLoading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  if (!config) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Smartphone className="h-16 w-16 text-muted-foreground/30" />
          <p className="text-muted-foreground">Nenhuma configuração encontrada</p>
          <Button onClick={() => createConfig.mutate()} disabled={createConfig.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Criar Configuração
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const IconPreview = ({ name }: { name: string }) => {
    const icons = LucideIcons as Record<string, any>;
    const Ic = icons[name] || LucideIcons.HelpCircle;
    return <Ic className="h-5 w-5" />;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── Global Config ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Configuração Global</CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="nav-active" className="text-xs">Ativo</Label>
                  <Switch id="nav-active" checked={config.is_active} onCheckedChange={(v) => setConfig({ ...config, is_active: v })} />
                </div>
                <Button size="sm" onClick={() => saveConfig.mutate(config)} disabled={saveConfig.isPending}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Salvar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Layout</Label>
                <Select value={config.layout_type} onValueChange={(v) => setConfig({ ...config, layout_type: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixo</SelectItem>
                    <SelectItem value="floating">Flutuante</SelectItem>
                    <SelectItem value="rounded">Arredondado</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Altura (px)</Label>
                <Input type="number" value={config.height} onChange={(e) => setConfig({ ...config, height: Number(e.target.value) })} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Cor de Fundo</Label>
                <Input value={config.background_color} onChange={(e) => setConfig({ ...config, background_color: e.target.value })} placeholder="Padrão do tema" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Cor da Borda</Label>
                <Input value={config.border_color} onChange={(e) => setConfig({ ...config, border_color: e.target.value })} placeholder="Padrão do tema" className="h-9" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={config.shadow} onCheckedChange={(v) => setConfig({ ...config, shadow: v })} />
                <Label className="text-xs">Sombra</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={config.blur} onCheckedChange={(v) => setConfig({ ...config, blur: v })} />
                <Label className="text-xs">Blur</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={config.mobile_only} onCheckedChange={(v) => setConfig({ ...config, mobile_only: v })} />
                <Label className="text-xs">Apenas Mobile</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Items ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Botões ({items.length}/5)</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowPreview(!showPreview)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                </Button>
                <Button size="sm" onClick={openNewItem} disabled={items.length >= 5}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Novo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum botão configurado. A barra usará o layout padrão.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5 bg-card">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <IconPreview name={item.icon} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.label || 'Sem label'}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{item.action_type === 'external' ? item.external_url : item.route_path}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!item.is_active && <Badge variant="secondary" className="text-[9px]">Off</Badge>}
                      {item.requires_auth && <Badge variant="outline" className="text-[9px]">Auth</Badge>}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveItem(idx, -1)} disabled={idx === 0}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditItem(item); setShowDialog(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem.mutate(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Preview ── */}
        {showPreview && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Preview Mobile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-[375px] rounded-2xl border-2 border-border bg-background overflow-hidden" style={{ height: 120 }}>
                <div className="flex items-center justify-around px-2 py-1.5 h-full border-t border-border/40 bg-card/90">
                  {items.filter(i => i.is_active).map((item) => {
                    const Ic = (LucideIcons as any)[item.icon] || LucideIcons.HelpCircle;
                    return (
                      <div key={item.id} className="flex flex-col items-center gap-0.5">
                        <div className="h-8 w-8 flex items-center justify-center">
                          <Ic className="h-[18px] w-[18px] text-muted-foreground" />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Edit Dialog ── */}
      <Dialog open={showDialog} onOpenChange={(v) => { if (!v) { setShowDialog(false); setEditItem(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem?.id ? 'Editar Botão' : 'Novo Botão'}</DialogTitle>
          </DialogHeader>

          {editItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Label</Label>
                  <Input value={editItem.label} onChange={(e) => setEditItem({ ...editItem, label: e.target.value })} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Tipo de Ação</Label>
                  <Select value={editItem.action_type} onValueChange={(v) => setEditItem({ ...editItem, action_type: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="route">Rota Interna</SelectItem>
                      <SelectItem value="external">Link Externo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editItem.action_type === 'route' ? (
                <div>
                  <Label className="text-xs">Rota</Label>
                  <Input value={editItem.route_path} onChange={(e) => setEditItem({ ...editItem, route_path: e.target.value })} placeholder="/" className="h-9" />
                </div>
              ) : (
                <div>
                  <Label className="text-xs">URL Externa</Label>
                  <Input value={editItem.external_url} onChange={(e) => setEditItem({ ...editItem, external_url: e.target.value })} placeholder="https://..." className="h-9" />
                </div>
              )}

              <div>
                <Label className="text-xs mb-2 block">Ícone</Label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_ICONS.map((name) => {
                    const Ic = (LucideIcons as any)[name] || LucideIcons.HelpCircle;
                    return (
                      <button
                        key={name}
                        onClick={() => setEditItem({ ...editItem, icon: name })}
                        className={`h-9 w-9 rounded-lg border flex items-center justify-center transition-colors ${editItem.icon === name ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground hover:bg-muted'}`}
                        title={name}
                      >
                        <Ic className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
                <Input value={editItem.icon} onChange={(e) => setEditItem({ ...editItem, icon: e.target.value })} placeholder="Nome do ícone Lucide" className="h-9 mt-2" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cor do Texto</Label>
                  <Input value={editItem.text_color} onChange={(e) => setEditItem({ ...editItem, text_color: e.target.value })} placeholder="Padrão" className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Cor Ativo</Label>
                  <Input value={editItem.active_color} onChange={(e) => setEditItem({ ...editItem, active_color: e.target.value })} placeholder="Padrão" className="h-9" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Badge</Label>
                  <Input value={editItem.badge} onChange={(e) => setEditItem({ ...editItem, badge: e.target.value })} placeholder="Ex: 3, Novo" className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Cor do Badge</Label>
                  <Input value={editItem.badge_color} onChange={(e) => setEditItem({ ...editItem, badge_color: e.target.value })} placeholder="Padrão" className="h-9" />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={editItem.is_active} onCheckedChange={(v) => setEditItem({ ...editItem, is_active: v })} />
                  <Label className="text-xs">Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editItem.requires_auth} onCheckedChange={(v) => setEditItem({ ...editItem, requires_auth: v })} />
                  <Label className="text-xs">Requer Login</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditItem(null); }}>Cancelar</Button>
            <Button onClick={() => {
              if (!editItem) return;
              if (!editItem.label.trim()) { toast.error('Label obrigatório'); return; }
              const payload: any = {
                config_id: editItem.config_id,
                label: editItem.label.trim(),
                icon: editItem.icon,
                icon_active: editItem.icon_active,
                route_path: editItem.route_path,
                external_url: editItem.external_url,
                action_type: editItem.action_type,
                order_index: editItem.order_index,
                is_active: editItem.is_active,
                badge: editItem.badge,
                badge_color: editItem.badge_color,
                text_color: editItem.text_color,
                active_color: editItem.active_color,
                background_color: editItem.background_color,
                border_radius: editItem.border_radius,
                size: editItem.size,
                animation: editItem.animation,
                requires_auth: editItem.requires_auth,
              };
              if (editItem.id) payload.id = editItem.id;
              saveItem.mutate(payload);
            }} disabled={saveItem.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminBottomNavPage;
