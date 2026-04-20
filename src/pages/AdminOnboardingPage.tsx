import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, Sparkles } from 'lucide-react';
import { useSeoHead } from '@/hooks/useSeoHead';

const PROFILE_TYPES = [
  { value: 'provider', label: 'Profissional' },
  { value: 'rh', label: 'Agência / RH' },
  { value: 'client', label: 'Cliente / Contratante' },
];

const ICON_SUGGESTIONS = ['Briefcase', 'Building2', 'User', 'Users', 'Sparkles', 'Megaphone', 'Star', 'Rocket'];

const AdminOnboardingPage = () => {
  useSeoHead({ title: 'Configurações de Onboarding', description: 'Gerencie a triagem de novos usuários', noindex: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    supabase.from('onboarding_settings' as any).select('*').limit(1).maybeSingle()
      .then(({ data }) => { setData(data); setLoading(false); });
  }, []);

  const save = async () => {
    if (!data?.id) return;
    setSaving(true);
    const { error } = await supabase.from('onboarding_settings' as any).update({
      title: data.title, subtitle: data.subtitle, active: data.active,
      card1_icon: data.card1_icon, card1_title: data.card1_title, card1_description: data.card1_description, card1_profile_type: data.card1_profile_type,
      card2_icon: data.card2_icon, card2_title: data.card2_title, card2_description: data.card2_description, card2_profile_type: data.card2_profile_type,
      card3_icon: data.card3_icon, card3_title: data.card3_title, card3_description: data.card3_description, card3_profile_type: data.card3_profile_type,
    }).eq('id', data.id);
    setSaving(false);
    if (error) toast.error('Erro ao salvar'); else toast.success('Configurações salvas!');
  };

  const update = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));

  if (loading) return <AdminLayout><p>Carregando...</p></AdminLayout>;
  if (!data) return <AdminLayout><p>Sem configurações.</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Onboarding de Usuários</h1>
          <p className="text-sm text-muted-foreground">Modal de triagem exibido após primeiro acesso ao /dashboard.</p>
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <div>
          <Label>Título principal</Label>
          <Input value={data.title} onChange={(e) => update('title', e.target.value)} />
        </div>
        <div>
          <Label>Subtítulo</Label>
          <Textarea rows={2} value={data.subtitle} onChange={(e) => update('subtitle', e.target.value)} />
        </div>
      </Card>

      <div className="grid gap-4 mt-4 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <Card key={n} className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">Card {n}</h3>
            <div>
              <Label className="text-xs">Ícone (Lucide)</Label>
              <Input list={`icons-${n}`} value={data[`card${n}_icon`]} onChange={(e) => update(`card${n}_icon`, e.target.value)} />
              <datalist id={`icons-${n}`}>
                {ICON_SUGGESTIONS.map(i => <option key={i} value={i} />)}
              </datalist>
            </div>
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={data[`card${n}_title`]} onChange={(e) => update(`card${n}_title`, e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={3} value={data[`card${n}_description`]} onChange={(e) => update(`card${n}_description`, e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Tipo de perfil ao escolher</Label>
              <select
                value={data[`card${n}_profile_type`]}
                onChange={(e) => update(`card${n}_profile_type`, e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {PROFILE_TYPES.map(p => <option key={p.value} value={p.value}>{p.label} ({p.value})</option>)}
              </select>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={saving} variant="accent">
          <Save className="mr-2 h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </div>
    </AdminLayout>
  );
};

export default AdminOnboardingPage;
