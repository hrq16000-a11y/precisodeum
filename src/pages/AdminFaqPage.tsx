import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Save, X, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Faq {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  active: boolean;
}

const AdminFaqPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [editing, setEditing] = useState<Partial<Faq> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchFaqs = async () => {
    const { data } = await supabase.from('faqs' as any).select('*').order('display_order');
    if (data) setFaqs(data as any);
  };

  useEffect(() => { if (isAdmin) fetchFaqs(); }, [isAdmin]);

  const handleSave = async () => {
    if (!editing?.question || !editing?.answer) { toast.error('Pergunta e resposta são obrigatórias'); return; }
    if (isNew) {
      const { error } = await (supabase.from('faqs' as any) as any).insert([editing]);
      if (error) { toast.error(error.message); return; }
      toast.success('FAQ criada!');
    } else {
      const { error } = await (supabase.from('faqs' as any) as any).update(editing).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('FAQ atualizada!');
    }
    setEditing(null); setIsNew(false); fetchFaqs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta FAQ?')) return;
    await (supabase.from('faqs' as any) as any).delete().eq('id', id);
    toast.success('Excluída'); fetchFaqs();
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <HelpCircle className="h-6 w-6" /> Perguntas Frequentes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie as FAQs exibidas na homepage</p>
        </div>
        <Button variant="accent" onClick={() => { setEditing({ question: '', answer: '', display_order: faqs.length + 1, active: true }); setIsNew(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>

      {editing && (
        <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-card space-y-3">
          <h3 className="font-display font-bold text-foreground">{isNew ? 'Nova FAQ' : 'Editar FAQ'}</h3>
          <Input placeholder="Pergunta" value={editing.question || ''} onChange={e => setEditing({ ...editing, question: e.target.value })} />
          <Textarea placeholder="Resposta" rows={3} value={editing.answer || ''} onChange={e => setEditing({ ...editing, answer: e.target.value })} />
          <Input type="number" placeholder="Ordem" value={editing.display_order || 0} onChange={e => setEditing({ ...editing, display_order: Number(e.target.value) })} className="w-24" />
          <div className="flex gap-2">
            <Button variant="accent" onClick={handleSave}><Save className="mr-1 h-4 w-4" /> Salvar</Button>
            <Button variant="outline" onClick={() => { setEditing(null); setIsNew(false); }}><X className="mr-1 h-4 w-4" /> Cancelar</Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {faqs.map(f => (
          <div key={f.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex-1 mr-4">
              <h3 className="text-sm font-bold text-foreground">{f.question}</h3>
              <p className="text-xs text-muted-foreground line-clamp-1">{f.answer}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${f.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {f.active ? 'Ativa' : 'Inativa'}
              </span>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(f); setIsNew(false); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(f.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {faqs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma FAQ cadastrada.</p>}
      </div>
    </AdminLayout>
  );
};

export default AdminFaqPage;
