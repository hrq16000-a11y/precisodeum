import { useState } from 'react';
import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SponsorDataPage = () => {
  const { sponsorContact, sponsor, loading, refetch } = useSponsorAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contact_name: '',
    company_name: '',
    email: '',
    phone: '',
  });
  const [initialized, setInitialized] = useState(false);

  if (!initialized && sponsorContact) {
    setForm({
      contact_name: (sponsorContact as any).contact_name || '',
      company_name: (sponsorContact as any).company_name || '',
      email: (sponsorContact as any).email || '',
      phone: (sponsorContact as any).phone || '',
    });
    setInitialized(true);
  }

  const handleSave = async () => {
    if (!sponsorContact) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sponsor_contacts' as any)
        .update({
          contact_name: form.contact_name,
          company_name: form.company_name,
          email: form.email,
          phone: form.phone,
        } as any)
        .eq('id', (sponsorContact as any).id);

      if (error) throw error;
      toast.success('Dados atualizados com sucesso!');
      await refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SponsorLayout>
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
      </SponsorLayout>
    );
  }

  return (
    <SponsorLayout>
      <div className="space-y-6 max-w-lg">
        <h1 className="text-2xl font-bold text-foreground">Meus Dados</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações de Contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Contato</Label>
              <Input
                value={form.contact_name}
                onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input
                value={form.company_name}
                onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Salvando...' : 'Salvar Dados'}
            </Button>
          </CardContent>
        </Card>

        {sponsor && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados do Patrocínio</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p><strong>Título:</strong> {sponsor.title}</p>
              <p><strong>Plano:</strong> <span className="capitalize">{sponsor.tier}</span></p>
              <p><strong>Posição:</strong> {sponsor.position}</p>
              <p className="text-xs mt-4">
                Para alterar dados do patrocínio, entre em contato com a equipe administrativa.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </SponsorLayout>
  );
};

export default SponsorDataPage;
