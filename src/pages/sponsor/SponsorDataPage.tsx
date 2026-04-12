import { useState } from 'react';
import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Save, Building2, User, Mail, Phone, Crown, MapPin, Globe, Loader2, Shield } from 'lucide-react';

const SponsorDataPage = () => {
  const { sponsorContact, sponsor, loading, refetch, permissions, isAdmin } = useSponsorAuth();
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
        <div className="space-y-4">
          <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      </SponsorLayout>
    );
  }

  const permList = Object.entries(permissions).filter(([, v]) => v).map(([k]) => k);

  return (
    <SponsorLayout>
      <div className="space-y-6 max-w-2xl">
        <motion.h1
          className="text-2xl font-bold text-foreground"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          Meus Dados
        </motion.h1>

        {/* Contact form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Informações de Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><User className="w-3 h-3 text-muted-foreground" /> Nome do Contato</Label>
                  <Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Building2 className="w-3 h-3 text-muted-foreground" /> Empresa</Label>
                  <Input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Mail className="w-3 h-3 text-muted-foreground" /> E-mail</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Phone className="w-3 h-3 text-muted-foreground" /> Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Dados
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sponsor info */}
        {sponsor && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="h-4 w-4" /> Dados do Patrocínio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Título</span>
                      <span className="font-medium">{sponsor.title}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Empresa</span>
                      <span className="font-medium">{(sponsor as any).company_name || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Plano</span>
                      <Badge variant="outline" className="capitalize gap-1">
                        <Crown className="w-3 h-3" /> {sponsor.tier}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Posição</span>
                      <Badge variant="outline">{sponsor.position}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={sponsor.active ? 'default' : 'secondary'}>
                        {sponsor.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Formato</span>
                      <Badge variant="outline">{(sponsor as any).ad_format || 'banner'}</Badge>
                    </div>
                  </div>
                </div>

                {/* Linked segments */}
                {((sponsor as any).linked_city || (sponsor as any).linked_category) && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Segmentação</p>
                    <div className="flex gap-2 flex-wrap">
                      {(sponsor as any).linked_city && (
                        <Badge variant="secondary" className="gap-1">
                          <MapPin className="w-3 h-3" /> {(sponsor as any).linked_city}
                        </Badge>
                      )}
                      {(sponsor as any).linked_category && (
                        <Badge variant="secondary" className="gap-1">
                          <Globe className="w-3 h-3" /> {(sponsor as any).linked_category}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-4">
                  Para alterar dados do patrocínio (plano, posição, segmentação), entre em contato com a equipe administrativa.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Permissions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" /> Permissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {permList.map(p => (
                  <Badge key={p} variant="outline" className="capitalize">{p}</Badge>
                ))}
                {isAdmin && <Badge className="bg-primary text-primary-foreground">Admin</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Suas permissões definem quais seções do painel você pode acessar. Caso precise de acesso adicional, solicite ao administrador.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </SponsorLayout>
  );
};

export default SponsorDataPage;
