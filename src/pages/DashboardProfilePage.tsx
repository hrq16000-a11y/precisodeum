import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AvatarUpload from '@/components/AvatarUpload';
import PortfolioUpload from '@/components/PortfolioUpload';
import { sanitizePhone, isValidWhatsApp, autoFillWhatsApp } from '@/lib/whatsapp';

const DashboardProfilePage = () => {
  const { user, profile, provider, loading, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({
    full_name: '', phone: '', business_name: '', description: '',
    city: '', state: '', neighborhood: '', whatsapp: '', website: '',
    years_experience: 0, category_id: '',
  });

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => {
      if (data) setCategories(data);
    });
  }, []);

  useEffect(() => {
    if (profile) {
      setForm(prev => ({ ...prev, full_name: profile.full_name || '', phone: profile.phone || '' }));
    }
    if (provider) {
      setForm(prev => ({
        ...prev,
        business_name: provider.business_name || '',
        description: provider.description || '',
        city: provider.city || '',
        state: provider.state || '',
        neighborhood: provider.neighborhood || '',
        whatsapp: provider.whatsapp || '',
        website: provider.website || '',
        years_experience: provider.years_experience || 0,
        category_id: provider.category_id || '',
      }));
    }
  }, [profile, provider]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'phone' || name === 'whatsapp') {
      setForm(prev => ({ ...prev, [name]: sanitizePhone(value) }));
    } else {
      setForm(prev => ({ ...prev, [name]: name === 'years_experience' ? Number(value) : value }));
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Auto-fill + validate WhatsApp
    const finalWhatsapp = autoFillWhatsApp(form.whatsapp, form.phone);
    if (finalWhatsapp && !isValidWhatsApp(finalWhatsapp)) {
      toast.error('Número de WhatsApp inválido (deve ter 10 ou 11 dígitos)');
      return;
    }
    const finalPhone = sanitizePhone(form.phone);
    if (finalPhone && !isValidWhatsApp(finalPhone)) {
      toast.error('Número de telefone inválido (deve ter 10 ou 11 dígitos)');
      return;
    }

    setSaving(true);

    try {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: form.full_name,
        phone: form.phone,
        email: user.email || '',
      }, { onConflict: 'id' });

      if (profileError) {
        toast.error('Erro ao salvar perfil: ' + profileError.message);
        setSaving(false);
        return;
      }

      if (provider) {
        const { error: providerError } = await supabase.from('providers').update({
          business_name: form.business_name || null,
          description: form.description,
          city: form.city,
          state: form.state,
          neighborhood: form.neighborhood,
          whatsapp: form.whatsapp,
          website: form.website || null,
          years_experience: form.years_experience,
          category_id: form.category_id || null,
        }).eq('id', provider.id);

        if (providerError) {
          toast.error('Erro ao salvar dados profissionais: ' + providerError.message);
          setSaving(false);
          return;
        }
      } else {
        const slug = `${form.full_name.toLowerCase().replace(/\s+/g, '-')}-${form.city.toLowerCase().replace(/\s+/g, '-')}`;
        const { error: insertError } = await supabase.from('providers').insert({
          user_id: user.id,
          business_name: form.business_name || null,
          description: form.description,
          city: form.city,
          state: form.state,
          neighborhood: form.neighborhood,
          phone: form.phone,
          whatsapp: form.whatsapp,
          category_id: form.category_id || null,
          slug,
          status: 'pending',
        });

        if (insertError) {
          toast.error('Erro ao criar perfil profissional: ' + insertError.message);
          setSaving(false);
          return;
        }
      }

      await refetchProfile();
      toast.success('Perfil salvo com sucesso!');
    } catch (err: any) {
      toast.error('Erro inesperado: ' + (err.message || 'Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  const initials = form.full_name.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  useEffect(() => {
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
  }, [profile]);

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Meu Perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">Edite suas informações profissionais</p>

      <div className="mt-6 max-w-2xl space-y-6">
        {/* Avatar upload */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card flex items-center gap-6">
          <AvatarUpload userId={user!.id} currentUrl={avatarUrl} initials={initials} onUploaded={setAvatarUrl} />
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Foto de Perfil</h2>
            <p className="text-sm text-muted-foreground">Clique no ícone da câmera para alterar (max 2MB)</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">Dados Pessoais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Nome completo</label>
              <input name="full_name" value={form.full_name} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Telefone</label>
              <input name="phone" value={form.phone} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">Dados Profissionais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Nome do negócio</label>
              <input name="business_name" value={form.business_name} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Categoria</label>
              <select name="category_id" value={form.category_id} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                <option value="">Selecione...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Cidade</label>
              <input name="city" value={form.city} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Estado</label>
              <input name="state" value={form.state} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Bairro</label>
              <input name="neighborhood" value={form.neighborhood} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">WhatsApp</label>
              <input name="whatsapp" value={form.whatsapp} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Website</label>
              <input name="website" value={form.website} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Anos de experiência</label>
              <input name="years_experience" type="number" value={form.years_experience} onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Descrição profissional</label>
            <textarea name="description" rows={4} value={form.description} onChange={handleChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
          </div>
        </div>

        {/* Portfolio */}
        {provider && user && (
          <PortfolioUpload userId={user.id} providerId={provider.id} />
        )}

        <Button variant="accent" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Perfil'}
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default DashboardProfilePage;
