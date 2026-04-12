import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GraduationCap, Plus, Trash2, Search, ExternalLink, Award, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { logAuditAction } from '@/hooks/useAuditLog';
import CategoryIcon from '@/components/CategoryIcon';
import IconPicker from '@/components/admin/IconPicker';

const CATEGORIES = [
  'empreendedorismo', 'vendas', 'marketing', 'financeiro',
  'técnico', 'segurança', 'tecnologia', 'gestão', 'atendimento', 'geral',
];

const LEVELS = ['iniciante', 'intermediário', 'avançado'];

const emptyCourse = {
  title: '', description: '', provider: '', url: '', category: 'geral',
  duration: '', level: 'iniciante', has_certificate: false, icon: 'GraduationCap',
  active: true, featured: false, display_order: 0, tags: [] as string[],
};

const AdminCoursesPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [courses, setCourses] = useState<any[]>([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [editCourse, setEditCourse] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagsInput, setTagsInput] = useState('');

  const fetchCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('*')
      .order('display_order');
    setCourses(data || []);
  };

  useEffect(() => { if (isAdmin) fetchCourses(); }, [isAdmin]);

  const filtered = useMemo(() => {
    return courses.filter(c => {
      if (filterCategory !== 'all' && c.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.title?.toLowerCase().includes(q) || c.provider?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [courses, filterCategory, search]);

  const openNew = () => {
    setEditCourse({ ...emptyCourse, display_order: courses.length });
    setTagsInput('');
    setIsNew(true);
  };

  const openEdit = (c: any) => {
    setEditCourse({ ...c });
    setTagsInput((c.tags || []).join(', '));
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editCourse) return;
    if (!editCourse.title.trim()) { toast.error('Título obrigatório'); return; }
    if (!editCourse.url.trim()) { toast.error('URL obrigatória'); return; }
    setSaving(true);

    const tags = tagsInput.split(',').map((t: string) => t.trim()).filter(Boolean);

    const payload = {
      title: editCourse.title, description: editCourse.description,
      provider: editCourse.provider, url: editCourse.url,
      category: editCourse.category, duration: editCourse.duration,
      level: editCourse.level, has_certificate: editCourse.has_certificate,
      icon: editCourse.icon, active: editCourse.active,
      featured: editCourse.featured, display_order: editCourse.display_order,
      tags,
    };

    if (isNew) {
      const { error } = await supabase.from('courses').insert(payload as any);
      if (error) toast.error(error.message);
      else {
        await logAuditAction({ action: 'create', resource_type: 'course', details: { title: payload.title } });
        toast.success('Curso criado!');
      }
    } else {
      const { error } = await supabase.from('courses').update(payload as any).eq('id', editCourse.id);
      if (error) toast.error(error.message);
      else {
        await logAuditAction({ action: 'update', resource_type: 'course', resource_id: editCourse.id });
        toast.success('Curso atualizado!');
      }
    }
    setSaving(false);
    setEditCourse(null);
    fetchCourses();
  };

  const handleDelete = async (c: any) => {
    if (!confirm(`Excluir "${c.title}"?`)) return;
    const { error } = await supabase.from('courses').delete().eq('id', c.id);
    if (error) toast.error(error.message);
    else {
      await logAuditAction({ action: 'delete', resource_type: 'course', resource_id: c.id });
      toast.success('Curso excluído!');
      fetchCourses();
    }
  };

  const handleToggle = async (c: any) => {
    await supabase.from('courses').update({ active: !c.active } as any).eq('id', c.id);
    toast.success(c.active ? 'Curso ocultado' : 'Curso ativado');
    fetchCourses();
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="h-6 w-6" /> Portal de Cursos
        </h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Curso</Button>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{filtered.length} curso(s)</p>

      <div className="mt-4 space-y-2">
        {filtered.map(course => (
          <Card key={course.id} className={!course.active ? 'opacity-50' : ''}>
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <CategoryIcon icon={course.icon} size={18} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{course.title}</span>
                  {course.featured && <Star className="h-3 w-3 text-amber-500 fill-amber-500 flex-shrink-0" />}
                  {course.has_certificate && <Award className="h-3 w-3 text-accent flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{course.provider}</span>
                  <span>•</span>
                  <span>{course.category}</span>
                  <span>•</span>
                  <span>{course.duration}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Switch checked={course.active} onCheckedChange={() => handleToggle(course)} />
                <Button size="sm" variant="ghost" onClick={() => openEdit(course)}>Editar</Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={course.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(course)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum curso encontrado.</p>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={!!editCourse} onOpenChange={open => !open && setEditCourse(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Novo Curso' : 'Editar Curso'}</DialogTitle>
          </DialogHeader>
          {editCourse && (
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={editCourse.title} onChange={e => setEditCourse({ ...editCourse, title: e.target.value })} placeholder="Ex: Eletricista Residencial" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea rows={3} value={editCourse.description} onChange={e => setEditCourse({ ...editCourse, description: e.target.value })} placeholder="Descrição do curso..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Instituição</Label>
                  <Input value={editCourse.provider} onChange={e => setEditCourse({ ...editCourse, provider: e.target.value })} placeholder="Ex: SEBRAE" />
                </div>
                <div>
                  <Label>Duração</Label>
                  <Input value={editCourse.duration} onChange={e => setEditCourse({ ...editCourse, duration: e.target.value })} placeholder="Ex: 4h" />
                </div>
              </div>
              <div>
                <Label>URL do Curso</Label>
                <Input value={editCourse.url} onChange={e => setEditCourse({ ...editCourse, url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={editCourse.category} onValueChange={v => setEditCourse({ ...editCourse, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nível</Label>
                  <Select value={editCourse.level} onValueChange={v => setEditCourse({ ...editCourse, level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ícone</Label>
                  <IconPicker value={editCourse.icon} onChange={v => setEditCourse({ ...editCourse, icon: v })} />
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input type="number" value={editCourse.display_order} onChange={e => setEditCourse({ ...editCourse, display_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <Label>Tags (separadas por vírgula)</Label>
                <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="empreendedorismo, MEI, finanças" />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={editCourse.active} onCheckedChange={v => setEditCourse({ ...editCourse, active: v })} />
                  <Label>Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editCourse.featured} onCheckedChange={v => setEditCourse({ ...editCourse, featured: v })} />
                  <Label>Destaque</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editCourse.has_certificate} onCheckedChange={v => setEditCourse({ ...editCourse, has_certificate: v })} />
                  <Label>Certificado</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCourse(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCoursesPage;
