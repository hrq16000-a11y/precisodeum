import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Menu, Plus, Trash2, GripVertical, Search, ExternalLink } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { logAuditAction } from '@/hooks/useAuditLog';

const MENU_LOCATIONS = [
  { value: 'header', label: 'Header' },
  { value: 'footer', label: 'Rodapé — Profissionais' },
  { value: 'footer_eco', label: 'Rodapé — Ecossistema' },
  { value: 'footer_suporte', label: 'Rodapé — Suporte' },
  { value: 'sidebar', label: 'Sidebar' },
  { value: 'mobile', label: 'Mobile' },
];

const emptyItem = {
  menu_location: 'header',
  label: '',
  url: '/',
  icon: '',
  parent_id: null as string | null,
  display_order: 0,
  active: true,
  open_in_new_tab: false,
};

const AdminMenuPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [items, setItems] = useState<any[]>([]);
  const [filterLocation, setFilterLocation] = useState('all');
  const [editItem, setEditItem] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .order('menu_location')
      .order('display_order');
    setItems(data || []);
  };

  useEffect(() => {
    if (isAdmin) fetchItems();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (filterLocation === 'all') return items;
    return items.filter(i => i.menu_location === filterLocation);
  }, [items, filterLocation]);

  const openNew = () => {
    setEditItem({ ...emptyItem, display_order: items.length });
    setIsNew(true);
  };

  const openEdit = (item: any) => {
    setEditItem({ ...item });
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editItem) return;
    if (!editItem.label.trim()) { toast.error('Label é obrigatório'); return; }
    setSaving(true);

    const payload = {
      menu_location: editItem.menu_location,
      label: editItem.label,
      url: editItem.url,
      icon: editItem.icon,
      parent_id: editItem.parent_id || null,
      display_order: editItem.display_order,
      active: editItem.active,
      open_in_new_tab: editItem.open_in_new_tab,
    };

    if (isNew) {
      const { error } = await supabase.from('menu_items').insert(payload as any);
      if (error) toast.error(error.message);
      else {
        await logAuditAction({ action: 'create', resource_type: 'menu_item', details: { label: payload.label } });
        toast.success('Item criado!');
      }
    } else {
      const { error } = await supabase.from('menu_items').update(payload as any).eq('id', editItem.id);
      if (error) toast.error(error.message);
      else {
        await logAuditAction({ action: 'update', resource_type: 'menu_item', resource_id: editItem.id });
        toast.success('Item atualizado!');
      }
    }
    setSaving(false);
    setEditItem(null);
    fetchItems();
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Excluir "${item.label}"?`)) return;
    const { error } = await supabase.from('menu_items').delete().eq('id', item.id);
    if (error) toast.error(error.message);
    else {
      await logAuditAction({ action: 'delete', resource_type: 'menu_item', resource_id: item.id });
      toast.success('Item excluído!');
      fetchItems();
    }
  };

  const handleToggle = async (item: any) => {
    const { error } = await supabase.from('menu_items').update({ active: !item.active } as any).eq('id', item.id);
    if (error) toast.error(error.message);
    else {
      toast.success(item.active ? 'Item ocultado' : 'Item ativado');
      fetchItems();
    }
  };

  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragLocation, setDragLocation] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, item: any) => {
    setDragItemId(item.id);
    setDragLocation(item.menu_location);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, item: any) => {
    e.preventDefault();
    if (item.menu_location !== dragLocation) return;
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(item.id);
  };

  const handleDrop = async (e: React.DragEvent, targetItem: any) => {
    e.preventDefault();
    setDragOverId(null);
    setDragItemId(null);
    setDragLocation(null);
    if (!dragItemId || dragItemId === targetItem.id) return;
    if (targetItem.menu_location !== dragLocation) return;

    const locationItems = items
      .filter(i => i.menu_location === targetItem.menu_location)
      .sort((a, b) => a.display_order - b.display_order);

    const fromIdx = locationItems.findIndex(i => i.id === dragItemId);
    const toIdx = locationItems.findIndex(i => i.id === targetItem.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...locationItems];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const updates = reordered.map((item, idx) =>
      supabase.from('menu_items').update({ display_order: idx } as any).eq('id', item.id)
    );
    await Promise.all(updates);
    toast.success('Ordem atualizada!');
    fetchItems();
  };

  const handleDragEnd = () => {
    setDragItemId(null);
    setDragOverId(null);
    setDragLocation(null);
  };

  const moveItem = async (item: any, direction: number) => {
    const locationItems = items
      .filter(i => i.menu_location === item.menu_location)
      .sort((a, b) => a.display_order - b.display_order);
    const idx = locationItems.findIndex(i => i.id === item.id);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= locationItems.length) return;

    const updates = [
      supabase.from('menu_items').update({ display_order: locationItems[targetIdx].display_order } as any).eq('id', item.id),
      supabase.from('menu_items').update({ display_order: item.display_order } as any).eq('id', locationItems[targetIdx].id),
    ];
    await Promise.all(updates);
    fetchItems();
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  // Group by location
  const grouped = MENU_LOCATIONS.map(loc => ({
    ...loc,
    items: filtered.filter(i => i.menu_location === loc.value),
  })).filter(g => filterLocation === 'all' ? true : g.value === filterLocation);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Menu className="h-6 w-6" /> Gestão de Menus
        </h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Item</Button>
      </div>

      <div className="mt-4 flex gap-3">
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Localização" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas localizações</SelectItem>
            {MENU_LOCATIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{filtered.length} item(s)</p>

      <div className="mt-4 space-y-6">
        {grouped.map(group => (
          group.items.length > 0 && (
            <div key={group.value}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</h2>
              <div className="space-y-1">
                {group.items.map((item, idx) => (
                  <Card
                    key={item.id}
                    draggable
                    onDragStart={e => handleDragStart(e, item)}
                    onDragOver={e => handleDragOver(e, item)}
                    onDrop={e => handleDrop(e, item)}
                    onDragEnd={handleDragEnd}
                    className={`transition-all cursor-grab active:cursor-grabbing ${!item.active ? 'opacity-50' : ''} ${dragOverId === item.id ? 'ring-2 ring-primary/50 scale-[1.01]' : ''} ${dragItemId === item.id ? 'opacity-40' : ''}`}
                  >
                    <CardContent className="flex items-center gap-3 py-2 px-4">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.icon && <CategoryIcon icon={item.icon} size={16} className="text-muted-foreground" />}
                          <span className="font-medium text-sm">{item.label}</span>
                          {item.parent_id && <Badge variant="outline" className="text-[10px]">sub</Badge>}
                          {item.open_in_new_tab && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => moveItem(item, -1)} disabled={idx === 0} className="h-7 w-7">
                          <span className="text-xs">↑</span>
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => moveItem(item, 1)} disabled={idx === group.items.length - 1} className="h-7 w-7">
                          <span className="text-xs">↓</span>
                        </Button>
                        <Switch checked={item.active} onCheckedChange={() => handleToggle(item)} />
                        <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>Editar</Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(item)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum item de menu. Crie o primeiro!</p>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editItem} onOpenChange={open => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Novo Item de Menu' : 'Editar Item'}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div>
                <Label>Localização</Label>
                <Select value={editItem.menu_location} onValueChange={v => setEditItem({ ...editItem, menu_location: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MENU_LOCATIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Label</Label>
                <Input value={editItem.label} onChange={e => setEditItem({ ...editItem, label: e.target.value })} placeholder="Ex: Sobre nós" />
              </div>
              <div>
                <Label>URL</Label>
                <Input value={editItem.url} onChange={e => setEditItem({ ...editItem, url: e.target.value })} placeholder="/sobre" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ícone (emoji/text)</Label>
                  <Input value={editItem.icon} onChange={e => setEditItem({ ...editItem, icon: e.target.value })} placeholder="🏠" />
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input type="number" value={editItem.display_order} onChange={e => setEditItem({ ...editItem, display_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <Label>Item pai (submenu)</Label>
                <Select value={editItem.parent_id || 'none'} onValueChange={v => setEditItem({ ...editItem, parent_id: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (raiz)</SelectItem>
                    {items.filter(i => !i.parent_id && i.id !== editItem.id).map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={editItem.active} onCheckedChange={v => setEditItem({ ...editItem, active: v })} />
                  <Label>Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editItem.open_in_new_tab} onCheckedChange={v => setEditItem({ ...editItem, open_in_new_tab: v })} />
                  <Label>Nova aba</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminMenuPage;
