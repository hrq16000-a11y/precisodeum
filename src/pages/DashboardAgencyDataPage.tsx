import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ExternalLink, Save, Loader2 } from 'lucide-react';
import { z } from 'zod';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import AvatarUpload from '@/components/AvatarUpload';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da agência').max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  whatsapp: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email('E-mail inválido').max(255).optional().or(z.literal('')),
  website: z.string().trim().url('URL inválida').max(255).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(2).optional().or(z.literal('')),
});

type AgencyForm = z.infer<typeof schema>;

const DashboardAgencyDataPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agency, setAgency] = useState<any>(null);
  const [form, setForm] = useState<AgencyForm>({
    name: '', description: '', whatsapp: '', email: '', website: '', city: '', state: '',
  });

  // Guard: Apenas RH pode acessar
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login', { replace: true }); return; }
    if (profile && profile.profile_type !== 'rh') {
      toast.error('Esta área é exclusiva para Agências de RH / Recrutamento');
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, user, profile, navigate]);

  // Carrega agência
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('agencies')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setAgency(data);
        setForm({
          name: data.name || '',
          description: data.description || '',
          whatsapp: data.whatsapp || '',
          email: data.email || '',
          website: data.website || '',
          city: data.city || '',
          state: data.state || '',
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        ...parsed.data,
        state: parsed.data.state ? parsed.data.state.toUpperCase() : '',
        user_id: user.id,
      };
      if (agency?.id) {
        const { error } = await (supabase as any)
          .from('agencies')
          .update(payload)
          .eq('id', agency.id);
        if (error) throw error;
      } else {
        // gera slug simples (trigger no banco poderia fazer; aqui geramos client-side)
        const slug = (parsed.data.name || 'agencia')
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          + '-' + user.id.slice(0, 6);
        const { data: created, error } = await (supabase as any)
          .from('agencies')
          .insert([{ ...payload, slug, status: 'pending' }])
          .select()
          .single();
        if (error) throw error;
        setAgency(created);
      }
      toast.success('Dados da agência salvos com sucesso');
    } catch (e: any) {
      console.error('[AgencyData]', e);
      toast.error(e?.message || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Dados da Agência</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Informações exibidas publicamente em <span className="font-mono text-foreground/80">/agencia/{agency?.slug || '...'}</span>
              </p>
            </div>
          </div>

          {agency?.slug && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              onClick={() => window.open(`/agencia/${agency.slug}`, '_blank', 'noopener')}
            >
              <ExternalLink className="h-4 w-4" />
              Ver minha página pública
            </Button>
          )}
        </header>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5">
            {/* Logo (avatar) — reaproveita o avatar do profile como logo da agência */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Logo da agência</Label>
              <p className="text-[11px] text-muted-foreground mb-2">Use uma imagem quadrada (mínimo 256x256px). É o mesmo avatar exibido no seu perfil.</p>
              {user && (
                <AvatarUpload
                  userId={user.id}
                  currentUrl={profile?.avatar_url}
                  initials={(form.name || profile?.full_name || 'A').slice(0, 2).toUpperCase()}
                  onUploaded={() => toast.success('Logo atualizada')}
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Nome da agência *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Talentos RH Brasil"
                  maxLength={120}
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="description">Sobre a agência</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Conte sobre seus serviços, áreas de atuação e diferenciais..."
                  rows={5}
                  maxLength={2000}
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">
                  {form.description?.length || 0}/2000
                </p>
              </div>

              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="11999999999"
                />
              </div>

              <div>
                <Label htmlFor="email">E-mail de contato</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contato@agencia.com.br"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://agencia.com.br"
                />
              </div>

              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="São Paulo"
                />
              </div>

              <div>
                <Label htmlFor="state">Estado (UF)</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardAgencyDataPage;
