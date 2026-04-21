import { useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { HelpCircle, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeoCity } from '@/hooks/useGeoCity';

const schema = z.object({
  service_query: z.string().trim().min(3, 'Descreva o serviço (mín. 3 caracteres)').max(200),
  city: z.string().trim().min(2, 'Informe a cidade').max(80),
  client_name: z.string().trim().min(2, 'Informe seu nome').max(80),
  client_whatsapp: z.string().trim().min(8, 'WhatsApp inválido').max(20),
  description: z.string().trim().max(500).optional(),
});

interface Props {
  defaultService?: string;
  defaultCategory?: string;
}

const AskSystemDialog = ({ defaultService = '', defaultCategory }: Props) => {
  const { user, profile } = useAuth();
  const { city: geoCity, state: geoState } = useGeoCity();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serviceQuery, setServiceQuery] = useState(defaultService);
  const [city, setCity] = useState(geoCity || '');
  const [name, setName] = useState(profile?.full_name || '');
  const [whatsapp, setWhatsapp] = useState((profile as any)?.whatsapp || '');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      service_query: serviceQuery,
      city,
      client_name: name,
      client_whatsapp: whatsapp,
      description,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Verifique os dados informados');
      return;
    }
    setLoading(true);
    try {
      const { data: lead, error } = await supabase
        .from('open_leads')
        .insert({
          client_user_id: user?.id || null,
          client_name: parsed.data.client_name,
          client_whatsapp: parsed.data.client_whatsapp,
          service_query: parsed.data.service_query,
          category_slug: defaultCategory || null,
          city: parsed.data.city,
          state: geoState || '',
          description: parsed.data.description || '',
        } as any)
        .select('id')
        .single();
      if (error) throw error;

      const { data: count } = await supabase.rpc('distribute_open_lead', { _open_lead_id: lead.id });

      toast.success(
        count && Number(count) > 0
          ? `Pedido enviado para ${count} profissional(is) de destaque na sua região.`
          : 'Pedido registrado. Profissionais serão notificados em breve.'
      );
      setOpen(false);
      setServiceQuery('');
      setDescription('');
    } catch (err: any) {
      toast.error('Não foi possível enviar agora. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="h-12 w-full gap-2 border-dashed border-accent/40 bg-accent/5 text-accent hover:bg-accent/10 sm:w-auto"
        >
          <HelpCircle className="h-4 w-4" />
          Não encontrou? Peça ajuda ao sistema
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Encontre o profissional ideal
          </DialogTitle>
          <DialogDescription>
            Descreva o que precisa. Vamos avisar os 3 melhores profissionais da sua região para que entrem em contato.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="ask-service">Qual serviço você precisa?</Label>
            <Input
              id="ask-service"
              value={serviceQuery}
              onChange={(e) => setServiceQuery(e.target.value)}
              placeholder="Ex: Eletricista para troca de chuveiro"
              maxLength={200}
              required
            />
          </div>
          <div>
            <Label htmlFor="ask-city">Cidade</Label>
            <Input
              id="ask-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex: São José dos Pinhais"
              maxLength={80}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ask-name">Seu nome</Label>
              <Input
                id="ask-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
              />
            </div>
            <div>
              <Label htmlFor="ask-wa">WhatsApp</Label>
              <Input
                id="ask-wa"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(00) 00000-0000"
                maxLength={20}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ask-desc">Detalhes (opcional)</Label>
            <Textarea
              id="ask-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quando precisa? Algum detalhe importante?"
              maxLength={500}
              rows={3}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sem leilão de preços. O sistema apenas conecta você aos profissionais disponíveis. A negociação é direta com o profissional escolhido.
          </p>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar pedido'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AskSystemDialog;
