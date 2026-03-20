import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Eye, Rss, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ImageUploadField from '@/components/ImageUploadField';

const emptyForm = { title: '', slug: '', content: '', excerpt: '', cover_image_url: '', author_name: 'Equipe Preciso de um', published: false, featured: false, source_url: '' };
const autoSlug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const AdminBlogPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [rssUrl, setRssUrl] = useState('');
  const [rssLoading, setRssLoading] = useState(false);

  if (!authLoading && !adminLoading && (!user || !isAdmin)) { navigate('/'); return null; }

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['admin-blog-posts'],
    queryFn: async () => {
      const { data } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title,
        slug: form.slug || autoSlug(form.title),
        content: form.content,
        excerpt: form.excerpt,
        cover_image_url: form.cover_image_url || null,
        author_name: form.author_name,
        published: form.published,
        featured: form.featured,
        source_url: form.source_url || null,
      };
      if (editingId) {
        const { error } = await supabase.from('blog_posts').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('blog_posts').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      toast({ title: editingId ? 'Post atualizado' : 'Post criado' });
      closeDialog();
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      toast({ title: 'Post removido' });
    },
  });

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      title: p.title, slug: p.slug, content: p.content, excerpt: p.excerpt,
      cover_image_url: p.cover_image_url || '', author_name: p.author_name,
      published: p.published, featured: p.featured, source_url: p.source_url || '',
    });
    setDialogOpen(true);
  };

  const handleRssImport = async () => {
    if (!rssUrl.trim()) return;
    setRssLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-rss', {
        body: { feed_url: rssUrl.trim(), max_items: 10 },
      });
      if (error) throw error;
      toast({ title: `RSS importado: ${data.imported} novos, ${data.skipped} já existentes` });
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      setRssUrl('');
    } catch (err: any) {
      toast({ title: 'Erro ao importar RSS: ' + (err.message || ''), variant: 'destructive' });
    } finally {
      setRssLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Blog / Notícias</h1>
          <p className="text-sm text-muted-foreground">{posts.length} post(s)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button variant="accent" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              <Plus className="h-4 w-4" /> Novo Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Post' : 'Novo Post'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div>
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: autoSlug(e.target.value) })} required />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>
              <div>
                <Label>Resumo</Label>
                <Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} />
              </div>
              <div>
                <Label>Conteúdo</Label>
                <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} />
              </div>
              <div>
                <Label>Imagem de Capa</Label>
                <ImageUploadField value={form.cover_image_url} onChange={(url) => setForm({ ...form, cover_image_url: url })} bucket="service-images" folder="blog" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Autor</Label>
                  <Input value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} />
                </div>
                <div>
                  <Label>URL Fonte (opcional)</Label>
                  <Input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
                  <Label>Publicado</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
                  <Label>Destaque na Home</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button type="submit" variant="accent" disabled={saveMutation.isPending}>Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* RSS Import Section */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Rss className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold text-foreground">Importar via RSS / Feed</h2>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="https://news.google.com/rss/search?q=emprego+brasil&hl=pt-BR"
            value={rssUrl}
            onChange={e => setRssUrl(e.target.value)}
            className="flex-1"
          />
          <Button variant="accent" onClick={handleRssImport} disabled={rssLoading || !rssUrl.trim()}>
            {rssLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rss className="h-4 w-4" />}
            Importar
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Cole a URL de qualquer feed RSS/Atom. Posts duplicados (mesmo slug) serão ignorados.
        </p>
      </div>

      {/* Posts Table */}
      <div className="mt-4 rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-muted-foreground">Carregando...</p>
        ) : posts.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">Nenhum post cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Fonte</TableHead>
                <TableHead className="hidden sm:table-cell">Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {p.cover_image_url && <img src={p.cover_image_url} alt="" className="h-8 w-8 rounded object-cover" />}
                      <div className="min-w-0">
                        <span className="font-medium text-foreground line-clamp-1">{p.title}</span>
                        <p className="text-[10px] text-muted-foreground">/{p.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.published ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                        {p.published ? 'Publicado' : 'Rascunho'}
                      </span>
                      {p.featured && <span title="Destaque">⭐</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                    {p.source_url ? <span title={p.source_url}>Externa</span> : 'Original'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild><Link to={`/blog/${p.slug}`} target="_blank"><Eye className="h-4 w-4" /></Link></Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminBlogPage;
