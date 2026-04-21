import { useEffect, useState } from 'react';
import { ExternalLink, Save, Loader2, Megaphone } from 'lucide-react';
import { z } from 'zod';
import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const schema = z.object({
  company_name: z.string().trim().min(2, 'Informe o nome do patrocinador').max(120),
  slug: z.string().trim().min(3, 'Slug deve ter ao menos 3 caracteres').max(60).regex(/^[a-z0-9-]+$/i, 'Use apenas letras, números e hífens'),
  full_description: z.string().trim().max(2000).optional().or(z.literal('')),
  short_description: z.string().trim().max(280).optional().or(z.literal('')),
  logo_url: z.string().trim().url('URL inválida').optional().or(z.literal('')),
  external_link: z.string().trim().url('URL inválida').optional().or(z.literal('')),
  whatsapp: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email('E-mail inválido').max(255).optional().or(z.literal('')),
});

type SponsorForm = z.infer<typeof schema>;

const SponsorPublicProfilePage = () => {
  const { sponsor, loading: authLoading, refetch } = useSponsorAuth(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SponsorForm>({
    company_name: '', slug: '', full_description: '', short_description: '',
    logo_url: '', external_link: '', whatsapp: '', email: '',
  });

  useEffect(() => {
    if (!sponsor) return;
    setForm({
      company_name: sponsor.company_name || sponsor.title || '',
      slug: (sponsor as any).slug || '',
      full_description: sponsor.full_description || '',
      short_description: sponsor.short_description || '',
      logo_url: sponsor.logo_url || '',
      external_link: (sponsor as any).external_link || sponsor.link_url || '',
      whatsapp: (sponsor as any).whatsapp || '',
      email: (sponsor as any).email || '',
    });
  }, [sponsor]);

  const handleSave = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!sponsor?.id) {
      toast.error('Não foi encontrado um registro de patrocinador associado à sua conta.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sponsors')
        .update(parsed.data)
        .eq('id', sponsor.id);
      if (error) throw error;
      toast.success('Página pública atualizada');
      await refetch();
    } catch (e: any) {
      console.error('[SponsorPublic]', e);
      toast.error(e?.message || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SponsorLayout>
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Megaphone className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">Personalizar Página</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Edite as informações exibidas em <span className="font-mono text-foreground/80">/patrocinador/{form.slug || '...'}</span>
              </p>
            </div>
          </div>

          {form.slug && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              onClick={() => window.open(`/patrocinador/${form.slug}`, '_blank', 'noopener')}
            >
              <ExternalLink className="h-4 w-4" />
              Ver minha página pública
            </Button>
          )}
        </header>

        {authLoading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="company_name">Nome do patrocinador *</Label>
                <Input
                  id="company_name"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  maxLength={120}
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug da URL *</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder="meu-patrocinador"
                  maxLength={60}
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="logo_url">URL do logo</Label>
                <Input
                  id="logo_url"
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="short_description">Descrição curta (resumo)</Label>
                <Input
                  id="short_description"
                  value={form.short_description}
                  onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                  maxLength={280}
                  placeholder="Frase de apresentação curta"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="full_description">Sobre o patrocinador</Label>
                <Textarea
                  id="full_description"
                  rows={5}
                  value={form.full_description}
                  onChange={(e) => setForm({ ...form, full_description: e.target.value })}
                  maxLength={2000}
                  placeholder="Conte sobre a empresa, produtos e diferenciais..."
                />
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
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="external_link">Website oficial</Label>
                <Input
                  id="external_link"
                  value={form.external_link}
                  onChange={(e) => setForm({ ...form, external_link: e.target.value })}
                  placeholder="https://"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar página pública
              </Button>
            </div>
          </div>
        )}
      </div>
    </SponsorLayout>
  );
};

export default SponsorPublicProfilePage;
