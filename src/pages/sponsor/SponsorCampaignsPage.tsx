import { useState } from 'react';
import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Megaphone, Plus, Calendar, DollarSign, Pencil, Pause, Play, Loader2, Trash2 } from 'lucide-react';

interface CampaignForm {
  name: string;
  description: string;
  budget: string;
  start_date: string;
  end_date: string;
}

const emptyForm: CampaignForm = { name: '', description: '', budget: '', start_date: '', end_date: '' };

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'secondary' },
  active: { label: 'Ativa', color: 'default' },
  paused: { label: 'Pausada', color: 'outline' },
  completed: { label: 'Concluída', color: 'secondary' },
};

const SponsorCampaignsPage = () => {
  const { sponsor, loading } = useSponsorAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['sponsor-campaigns', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_campaigns')
        .select('*')
        .eq('sponsor_id', sponsor!.id)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase
        .from('sponsor_campaigns')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('sponsor_id', sponsor!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsor-campaigns'] });
      toast.success('Status da campanha atualizado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar'),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sponsor_campaigns')
        .delete()
        .eq('id', id)
        .eq('sponsor_id', sponsor!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsor-campaigns'] });
      toast.success('Campanha excluída');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao excluir'),
  });

  const handleOpenNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      name: c.name || '',
      description: c.description || '',
      budget: c.budget ? String(c.budget) : '',
      start_date: c.start_date ? c.start_date.split('T')[0] : '',
      end_date: c.end_date ? c.end_date.split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome da campanha é obrigatório');
      return;
    }
    if (!sponsor) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        budget: form.budget ? Number(form.budget) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        sponsor_id: sponsor.id,
      };

      if (editId) {
        const { error } = await supabase
          .from('sponsor_campaigns')
          .update(payload)
          .eq('id', editId)
          .eq('sponsor_id', sponsor.id);
        if (error) throw error;
        toast.success('Campanha atualizada');
      } else {
        const { error } = await supabase
          .from('sponsor_campaigns')
          .insert({ ...payload, status: 'draft' });
        if (error) throw error;
        toast.success('Campanha criada com sucesso!');
      }

      qc.invalidateQueries({ queryKey: ['sponsor-campaigns'] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <SponsorLayout>
        <div className="space-y-4">
          <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map(i => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}
          </div>
        </div>
      </SponsorLayout>
    );
  }

  const activeCampaigns = campaigns.filter((c: any) => c.status === 'active').length;
  const totalBudget = campaigns.reduce((s: number, c: any) => s + (Number(c.budget) || 0), 0);

  return (
    <SponsorLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <motion.h1
            className="text-2xl font-bold text-foreground"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            Campanhas
          </motion.h1>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenNew}>
                <Plus className="w-4 h-4 mr-2" /> Nova Campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editId ? 'Editar Campanha' : 'Nova Campanha'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome da campanha" />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Objetivo da campanha" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Orçamento (R$)</Label>
                  <Input type="number" step="0.01" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="0,00" />
                </div>
                <Button className="w-full" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editId ? 'Salvar Alterações' : 'Criar Campanha'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{campaigns.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ativas</p>
                <p className="text-xl font-bold">{activeCampaigns}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Orçamento Total</p>
                <p className="text-xl font-bold">R$ {totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaign cards */}
        {campaigns.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {campaigns.map((c: any, i: number) => {
              const st = statusMap[c.status] || statusMap.draft;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Megaphone className="h-4 w-4" /> {c.name}
                        </CardTitle>
                        <Badge variant={st.color as any}>{st.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {c.description && <p className="text-muted-foreground line-clamp-2">{c.description}</p>}

                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {c.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {new Date(c.start_date).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        {c.end_date && (
                          <span className="flex items-center gap-1">
                            → {new Date(c.end_date).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        {c.budget > 0 && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> R$ {Number(c.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>
                          <Pencil className="w-3 h-3 mr-1" /> Editar
                        </Button>
                        {c.status === 'active' ? (
                          <Button variant="outline" size="sm" onClick={() => toggleStatus.mutate({ id: c.id, newStatus: 'paused' })}>
                            <Pause className="w-3 h-3 mr-1" /> Pausar
                          </Button>
                        ) : c.status !== 'completed' ? (
                          <Button variant="outline" size="sm" onClick={() => toggleStatus.mutate({ id: c.id, newStatus: 'active' })}>
                            <Play className="w-3 h-3 mr-1" /> Ativar
                          </Button>
                        ) : null}
                        {c.status === 'draft' && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteCampaign.mutate(c.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <Megaphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground mb-4">Nenhuma campanha cadastrada</p>
              <Button onClick={handleOpenNew}>
                <Plus className="w-4 h-4 mr-2" /> Criar Primeira Campanha
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </SponsorLayout>
  );
};

export default SponsorCampaignsPage;
