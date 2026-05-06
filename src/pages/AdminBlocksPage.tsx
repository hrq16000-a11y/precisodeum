import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Blocks, Plus, Copy, Trash2, Eye, EyeOff, GripVertical, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { logAuditAction } from '@/hooks/useAuditLog';

const BLOCK_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'banner', label: 'Banner' },
  { value: 'cta', label: 'CTA (Chamada)' },
  { value: 'cards', label: 'Cards' },
  { value: 'html', label: 'HTML Livre' },
  { value: 'sponsors', label: 'Patrocinadores' },
  { value: 'services', label: 'Serviços' },
  { value: 'testimonials', label: 'Depoimentos' },
  { value: 'faq', label: 'FAQ' },
  { value: 'image', label: 'Imagem' },
];

const PAGE_SLUGS = [
  { value: 'home', label: 'Home' },
  { value: 'about', label: 'Sobre' },
  { value: 'search', label: 'Busca' },
  { value: 'category', label: 'Categoria' },
  { value: 'city', label: 'Cidade' },
  { value: 'provider', label: 'Perfil Prestador' },
  { value: 'jobs', label: 'Vagas' },
  { value: 'blog', label: 'Blog' },
  { value: 'custom', label: 'Personalizada' },
];

const emptyBlock = {
  page_slug: 'home',
  block_type: 'text',
  title: '',
  subtitle: '',
  content: {},
  display_order: 0,
  active: true,
  start_date: null as string | null,
  end_date: null as string | null,
  target_city: null as string | null,
  target_category: null as string | null,
  target_campaign: null as string | null,
  sponsor_id: null as string | null,
};

const AdminBlocksPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [blocks, setBlocks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterPage, setFilterPage] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [editBlock, setEditBlock] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contentText, setContentText] = useState('');

  const fetchBlocks = async () => {
    const { data } = await supabase
      .from('page_blocks')
      .select('*')
      .order('page_slug')
      .order('display_order');
    setBlocks(data || []);
  };

  useEffect(() => {
    if (isAdmin) fetchBlocks();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    let list = blocks;
    if (filterPage !== 'all') list = list.filter(b => b.page_slug === filterPage);
    if (filterType !== 'all') list = list.filter(b => b.block_type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        (b.title || '').toLowerCase().includes(q) ||
        (b.subtitle || '').toLowerCase().includes(q) ||
        (b.page_slug || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [blocks, search, filterPage, filterType]);

  const openNew = () => {
    setEditBlock({ ...emptyBlock, display_order: blocks.length });
    setContentText('{}');
    setIsNew(true);
  };

  const openEdit = (block: any) => {
    setEditBlock({ ...block });
    setContentText(JSON.stringify(block.content || {}, null, 2));
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editBlock) return;
    setSaving(true);
    let parsedContent = {};
    try {
      parsedContent = JSON.parse(contentText || '{}');
    } catch {
      toast.error('JSON inválido no campo conteúdo');
      setSaving(false);
      return;
    }
    const payload = {
      page_slug: editBlock.page_slug,
      block_type: editBlock.block_type,
      title: editBlock.title,
      subtitle: editBlock.subtitle,
      content: parsedContent,
      display_order: editBlock.display_order,
      active: editBlock.active,
      start_date: editBlock.start_date || null,
      end_date: editBlock.end_date || null,
      target_city: editBlock.target_city || null,
      target_category: editBlock.target_category || null,
      target_campaign: editBlock.target_campaign || null,
      sponsor_id: editBlock.sponsor_id || null,
    };

    if (isNew) {
      const { error } = await supabase.from('page_blocks').insert(payload as any);
      if (error) toast.error(error.message);
      else {
        await logAuditAction({ action: 'create', resource_type: 'page_block', details: { title: payload.title } });
        toast.success('Bloco criado!');
      }
    } else {
      const { error } = await supabase.from('page_blocks').update(payload as any).eq('id', editBlock.id);
      if (error) toast.error(error.message);
      else {
        await logAuditAction({ action: 'update', resource_type: 'page_block', resource_id: editBlock.id, details: { title: payload.title } });
        toast.success('Bloco atualizado!');
      }
    }
    setSaving(false);
    setEditBlock(null);
    fetchBlocks();
  };

  const handleDuplicate = async (block: any) => {
    const { id, created_at, updated_at, ...rest } = block;
    const { error } = await supabase.from('page_blocks').insert({ ...rest, title: `${rest.title} (cópia)`, display_order: blocks.length } as any);
    if (error) toast.error(error.message);
    else {
      await logAuditAction({ action: 'duplicate', resource_type: 'page_block', resource_id: id });
      toast.success('Bloco duplicado!');
      fetchBlocks();
    }
  };

  const handleToggle = async (block: any) => {
    const { error } = await supabase.from('page_blocks').update({ active: !block.active } as any).eq('id', block.id);
    if (error) toast.error(error.message);
    else {
      toast.success(block.active ? 'Bloco ocultado' : 'Bloco ativado');
      fetchBlocks();
    }
  };

  const handleDelete = async (block: any) => {
    if (!confirm(`Excluir bloco "${block.title}"?`)) return;
    const { error } = await supabase.from('page_blocks').delete().eq('id', block.id);
    if (error) toast.error(error.message);
    else {
      await logAuditAction({ action: 'delete', resource_type: 'page_block', resource_id: block.id });
      toast.success('Bloco excluído!');
      fetchBlocks();
    }
  };

  const moveBlock = async (block: any, direction: number) => {
    const newOrder = block.display_order + direction;
    await supabase.from('page_blocks').update({ display_order: newOrder } as any).eq('id', block.id);
    fetchBlocks();
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Blocks className="h-6 w-6" /> Blocos de Página
        </h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Bloco</Button>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar blocos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterPage} onValueChange={setFilterPage}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Página" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas páginas</SelectItem>
            {PAGE_SLUGS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            {BLOCK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{filtered.length} bloco(s) encontrado(s)</p>

      {/* Block list */}
      <div className="mt-4 space-y-2">
        {filtered.map(block => (
          <Card key={block.id} className={`${!block.active ? 'opacity-50' : ''}`}>
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveBlock(block, -1)} className="text-muted-foreground hover:text-foreground"><GripVertical className="h-3 w-3 rotate-180" /></button>
                <button onClick={() => moveBlock(block, 1)} className="text-muted-foreground hover:text-foreground"><GripVertical className="h-3 w-3" /></button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{block.title || '(sem título)'}</span>
                  <Badge variant="secondary" className="text-[10px]">{block.block_type}</Badge>
                  <Badge variant="outline" className="text-[10px]">{block.page_slug}</Badge>
                  {block.target_city && <Badge variant="outline" className="text-[10px]">🏙 {block.target_city}</Badge>}
                  {block.target_campaign && <Badge variant="outline" className="text-[10px]">📢 {block.target_campaign}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{block.subtitle}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => handleToggle(block)} title={block.active ? 'Ocultar' : 'Ativar'}>
                  {block.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDuplicate(block)} title="Duplicar">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(block)} title="Editar">
                  <Filter className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(block)} title="Excluir" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum bloco encontrado. Crie o primeiro!</p>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editBlock} onOpenChange={open => !open && setEditBlock(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Novo Bloco' : 'Editar Bloco'}</DialogTitle>
          </DialogHeader>
          {editBlock && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Página</Label>
                  <Select value={editBlock.page_slug} onValueChange={v => setEditBlock({ ...editBlock, page_slug: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAGE_SLUGS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={editBlock.block_type} onValueChange={v => setEditBlock({ ...editBlock, block_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BLOCK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Título</Label>
                <Input value={editBlock.title} onChange={e => setEditBlock({ ...editBlock, title: e.target.value })} />
              </div>
              <div>
                <Label>Subtítulo</Label>
                <Input value={editBlock.subtitle} onChange={e => setEditBlock({ ...editBlock, subtitle: e.target.value })} />
              </div>
              <div>
                <Label>Conteúdo (JSON)</Label>
                <Textarea rows={6} value={contentText} onChange={e => setContentText(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ordem</Label>
                  <Input type="number" value={editBlock.display_order} onChange={e => setEditBlock({ ...editBlock, display_order: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={editBlock.active} onCheckedChange={v => setEditBlock({ ...editBlock, active: v })} />
                  <Label>Ativo</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data início</Label>
                  <Input type="datetime-local" value={editBlock.start_date?.slice(0, 16) || ''} onChange={e => setEditBlock({ ...editBlock, start_date: e.target.value || null })} />
                </div>
                <div>
                  <Label>Data fim</Label>
                  <Input type="datetime-local" value={editBlock.end_date?.slice(0, 16) || ''} onChange={e => setEditBlock({ ...editBlock, end_date: e.target.value || null })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cidade alvo</Label>
                  <Input value={editBlock.target_city || ''} onChange={e => setEditBlock({ ...editBlock, target_city: e.target.value || null })} placeholder="Ex: São Paulo" />
                </div>
                <div>
                  <Label>Categoria alvo</Label>
                  <Input value={editBlock.target_category || ''} onChange={e => setEditBlock({ ...editBlock, target_category: e.target.value || null })} placeholder="Ex: eletricista" />
                </div>
              </div>
              <div>
                <Label>Campanha alvo</Label>
                <Input value={editBlock.target_campaign || ''} onChange={e => setEditBlock({ ...editBlock, target_campaign: e.target.value || null })} placeholder="Ex: black-friday" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBlock(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminBlocksPage;
