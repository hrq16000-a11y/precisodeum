import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, Plus, Trash2, Eye, EyeOff, Search, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { logAuditAction } from '@/hooks/useAuditLog';

const emptyPage = {
  slug: '',
  title: '',
  content: '',
  meta_title: '',
  meta_description: '',
  published: false,
  display_order: 0,
};

const AdminInstitutionalPagesPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [pages, setPages] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editPage, setEditPage] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPages = async () => {
    const { data } = await supabase
      .from('institutional_pages')
      .select('*')
      .order('display_order');
    setPages(data || []);
  };

  useEffect(() => {
    if (isAdmin) fetchPages();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (!search.trim()) return pages;
    const q = search.toLowerCase();
    return pages.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q)
    );
  }, [pages, search]);

  const openNew = () => {
    setEditPage({ ...emptyPage, display_order: pages.length });
    setIsNew(true);
  };

  const openEdit = (page: any) => {
    setEditPage({ ...page });
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editPage) return;
    if (!editPage.slug.trim()) { toast.error('Slug é obrigatório'); return; }
    if (!editPage.title.trim()) { toast.error('Título é obrigatório'); return; }
    setSaving(true);

    const payload = {
      slug: editPage.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
      title: editPage.title,
      content: editPage.content,
      meta_title: editPage.meta_title,
      meta_description: editPage.meta_description,
      published: editPage.published,
      display_order: editPage.display_order,
    };

    if (isNew) {
      const { error } = await supabase.from('institutional_pages').insert(payload as any);
      if (error) {
        toast.error(error.code === '23505' ? 'Slug já existe' : error.message);
      } else {
        await logAuditAction({ action: 'create', resource_type: 'institutional_page', details: { title: payload.title, slug: payload.slug } });
        toast.success('Página criada!');
        setEditPage(null);
        fetchPages();
      }
    } else {
      const { error } = await supabase.from('institutional_pages').update(payload as any).eq('id', editPage.id);
      if (error) toast.error(error.message);
      else {
        await logAuditAction({ action: 'update', resource_type: 'institutional_page', resource_id: editPage.id, details: { title: payload.title } });
        toast.success('Página atualizada!');
        setEditPage(null);
        fetchPages();
      }
    }
    setSaving(false);
  };

  const handleTogglePublish = async (page: any) => {
    const { error } = await supabase.from('institutional_pages').update({ published: !page.published } as any).eq('id', page.id);
    if (error) toast.error(error.message);
    else {
      toast.success(page.published ? 'Página despublicada' : 'Página publicada');
      fetchPages();
    }
  };

  const handleDelete = async (page: any) => {
    if (!confirm(`Excluir página "${page.title}"?`)) return;
    const { error } = await supabase.from('institutional_pages').delete().eq('id', page.id);
    if (error) toast.error(error.message);
    else {
      await logAuditAction({ action: 'delete', resource_type: 'institutional_page', resource_id: page.id });
      toast.success('Página excluída!');
      fetchPages();
    }
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6" /> Páginas Institucionais
        </h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Página</Button>
      </div>

      <div className="mt-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar páginas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{filtered.length} página(s)</p>

      <div className="mt-4 space-y-2">
        {filtered.map(page => (
          <Card key={page.id}>
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{page.title}</span>
                  <Badge variant={page.published ? 'default' : 'secondary'} className="text-[10px]">
                    {page.published ? 'Publicada' : 'Rascunho'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">/p/{page.slug}</p>
              </div>
              <div className="flex items-center gap-1">
                {page.published && (
                  <Button size="icon" variant="ghost" asChild title="Ver página">
                    <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => handleTogglePublish(page)} title={page.published ? 'Despublicar' : 'Publicar'}>
                  {page.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(page)}>Editar</Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(page)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhuma página encontrada.</p>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editPage} onOpenChange={open => !open && setEditPage(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Nova Página' : 'Editar Página'}</DialogTitle>
          </DialogHeader>
          {editPage && (
            <div className="space-y-4">
              <div>
                <Label>Slug (URL)</Label>
                <Input value={editPage.slug} onChange={e => setEditPage({ ...editPage, slug: e.target.value })} placeholder="ex: sobre-nos" />
                <p className="text-[10px] text-muted-foreground mt-1">Acessível em /p/{editPage.slug || 'slug'}</p>
              </div>
              <div>
                <Label>Título</Label>
                <Input value={editPage.title} onChange={e => setEditPage({ ...editPage, title: e.target.value })} />
              </div>
              <div>
                <Label>Conteúdo (HTML/Markdown)</Label>
                <Textarea rows={12} value={editPage.content} onChange={e => setEditPage({ ...editPage, content: e.target.value })} className="font-mono text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Meta Title (SEO)</Label>
                  <Input value={editPage.meta_title} onChange={e => setEditPage({ ...editPage, meta_title: e.target.value })} />
                </div>
                <div>
                  <Label>Meta Description (SEO)</Label>
                  <Input value={editPage.meta_description} onChange={e => setEditPage({ ...editPage, meta_description: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ordem</Label>
                  <Input type="number" value={editPage.display_order} onChange={e => setEditPage({ ...editPage, display_order: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={editPage.published} onCheckedChange={v => setEditPage({ ...editPage, published: v })} />
                  <Label>Publicada</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPage(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminInstitutionalPagesPage;
