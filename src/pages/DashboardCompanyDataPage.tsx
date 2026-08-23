/**
 * DashboardCompanyDataPage — Gestão dos dados institucionais do prestador PJ.
 *
 * Rota: `/dashboard/empresa`. Acesso: profile_type === 'provider' &&
 * providers.account_type === 'company'.
 *
 * Diferenças vs. DashboardAgencyDataPage:
 *  - PJ usa a tabela `providers` (Single-Table Inheritance), NÃO `agencies`.
 *  - Não compartilha schema/lógica de RH/agências.
 *  - Inclui o toggle de privacidade `show_full_address` que controla se o
 *    card público mostra rua/número ou apenas bairro/cidade.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from '@/lib/router-compat';
import { Building2, Save, Loader2, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { normalizeProviderPayload } from '@/lib/providerPayload';

const schema = z.object({
  business_name: z.string().trim().min(2, 'Informe o nome fantasia').max(120),
  legal_name: z.string().trim().max(160).optional().or(z.literal('')),
  business_segment: z.string().trim().max(120).optional().or(z.literal('')),
  website: z.string().trim().url('URL inválida').max(255).optional().or(z.literal('')),
  street: z.string().trim().max(160).optional().or(z.literal('')),
  street_number: z.string().trim().max(20).optional().or(z.literal('')),
  complement: z.string().trim().max(120).optional().or(z.literal('')),
  postal_code: z.string().trim().max(12).optional().or(z.literal('')),
  show_full_address: z.boolean().optional(),
});

type CompanyForm = z.infer<typeof schema>;

const initialForm: CompanyForm = {
  business_name: '',
  legal_name: '',
  business_segment: '',
  website: '',
  street: '',
  street_number: '',
  complement: '',
  postal_code: '',
  show_full_address: false,
};

const DashboardCompanyDataPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<any>(null);
  const [form, setForm] = useState<CompanyForm>(initialForm);

  // Guard de tipo: já garantido por ProtectedRoute allowedTypes={['provider']} na rota.
  // Removido useEffect+navigate duplicado para evitar redirect espúrio durante
  // estados transitórios de carregamento do profile (audit-fix #9).


  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('providers')
        .select(
          'id, account_type, business_name, legal_name, business_segment, website, street, street_number, complement, postal_code, show_full_address, city, state, neighborhood',
        )
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        toast.error('Não foi possível carregar os dados da empresa.');
        setLoading(false);
        return;
      }
      if (!data || data.account_type !== 'company') {
        toast.info('Sua conta não está marcada como empresa. Atualize seu cadastro para acessar esta página.');
        navigate('/dashboard', { replace: true });
        return;
      }
      setProvider(data);
      setForm({
        business_name: data.business_name || '',
        legal_name: data.legal_name || '',
        business_segment: data.business_segment || '',
        website: ((data as any).website as string) || '',
        street: data.street || '',
        street_number: data.street_number || '',
        complement: data.complement || '',
        postal_code: data.postal_code || '',
        show_full_address: data.show_full_address === true,
      });
      setLoading(false);
    })();
  }, [user, navigate]);

  const update = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !provider?.id) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Verifique os campos do formulário.');
      return;
    }
    setSaving(true);
    try {
      const payload = normalizeProviderPayload({
        account_type: 'company',
        business_name: parsed.data.business_name,
        legal_name: parsed.data.legal_name || null,
        business_segment: parsed.data.business_segment || null,
        street: parsed.data.street || null,
        street_number: parsed.data.street_number || null,
        complement: parsed.data.complement || null,
        postal_code: parsed.data.postal_code || null,
        show_full_address: parsed.data.show_full_address === true,
        // campos NOT NULL preservados via banco — passamos placeholders só se necessários
        description: provider.description ?? '',
        city: provider.city ?? '',
        state: provider.state ?? '',
        neighborhood: provider.neighborhood ?? '',
        phone: provider.phone ?? '',
        whatsapp: provider.whatsapp ?? '',
      });

      const { error } = await (supabase as any)
        .from('providers')
        .update({
          business_name: payload.business_name,
          legal_name: payload.legal_name,
          business_segment: payload.business_segment,
          website: parsed.data.website || null,
          street: payload.street,
          street_number: payload.street_number,
          complement: payload.complement,
          postal_code: payload.postal_code,
          show_full_address: payload.show_full_address,
        })
        .eq('id', provider.id);
      if (error) throw error;
      toast.success('Dados da empresa atualizados.');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar dados da empresa.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        <header className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-foreground">Minha Empresa</h1>
            <p className="text-sm text-muted-foreground">
              Informe os dados institucionais (opcional). Use o controle de privacidade para decidir o que aparece no seu perfil público.
            </p>
          </div>
        </header>

        <form onSubmit={onSave} className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-xs">
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Identidade
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="business_name">Nome Fantasia</Label>
                <Input
                  id="business_name"
                  value={form.business_name}
                  onChange={(e) => update('business_name', e.target.value)}
                  placeholder="Como sua empresa é conhecida"
                  required
                />
              </div>
              <div>
                <Label htmlFor="legal_name">Razão Social</Label>
                <Input
                  id="legal_name"
                  value={form.legal_name || ''}
                  onChange={(e) => update('legal_name', e.target.value)}
                  placeholder="Nome registrado em CNPJ"
                />
              </div>
              <div>
                <Label htmlFor="business_segment">Segmento</Label>
                <Input
                  id="business_segment"
                  value={form.business_segment || ''}
                  onChange={(e) => update('business_segment', e.target.value)}
                  placeholder="Ex: Oficina mecânica, Salão de beleza"
                />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={form.website || ''}
                  onChange={(e) => update('website', e.target.value)}
                  placeholder="https://exemplo.com.br"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Endereço da unidade física
            </h2>
            <p className="text-xs text-muted-foreground">
              Opcional. Preencha apenas se sua empresa atende em ponto físico (oficina, salão, loja).
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
              <div>
                <Label htmlFor="street">Logradouro</Label>
                <Input
                  id="street"
                  value={form.street || ''}
                  onChange={(e) => update('street', e.target.value)}
                  placeholder="Rua / Avenida"
                />
              </div>
              <div>
                <Label htmlFor="street_number">Número</Label>
                <Input
                  id="street_number"
                  value={form.street_number || ''}
                  onChange={(e) => update('street_number', e.target.value)}
                  placeholder="123"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  value={form.complement || ''}
                  onChange={(e) => update('complement', e.target.value)}
                  placeholder="Sala / Bloco (opcional)"
                />
              </div>
              <div>
                <Label htmlFor="postal_code">CEP</Label>
                <Input
                  id="postal_code"
                  inputMode="numeric"
                  value={form.postal_code || ''}
                  onChange={(e) => update('postal_code', e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="00000-000"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-amber-600">
                {form.show_full_address ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <Label htmlFor="show_full_address" className="text-base font-bold text-foreground">
                  Exibir endereço completo no meu perfil público
                </Label>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {form.show_full_address ? (
                    <>Rua e número <strong>aparecerão</strong> no card público e na página da empresa.</>
                  ) : (
                    <>
                      Apenas <strong>bairro e cidade</strong> serão exibidos no card. Mostraremos a indicação{' '}
                      <em>“Ponto de Atendimento Físico”</em>, sem revelar a rua e o número.
                    </>
                  )}
                </p>
              </div>
              <Switch
                id="show_full_address"
                checked={form.show_full_address === true}
                onCheckedChange={(v) => update('show_full_address', v)}
              />
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} size="lg">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Salvar alterações
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default DashboardCompanyDataPage;
