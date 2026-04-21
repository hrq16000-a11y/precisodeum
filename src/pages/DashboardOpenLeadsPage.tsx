import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, MessageCircle, MapPin, Clock, Inbox, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { whatsappLink } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OpenLeadInvite {
  id: string;
  status: string;
  responded_at: string | null;
  open_lead: {
    id: string;
    service_query: string;
    description: string;
    city: string;
    state: string;
    client_name: string;
    client_whatsapp: string;
    expires_at: string;
    created_at: string;
    status: string;
  };
}

const DashboardOpenLeadsPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<OpenLeadInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('open_lead_responses')
      .select('id,status,responded_at,open_lead:open_leads(id,service_query,description,city,state,client_name,client_whatsapp,expires_at,created_at,status)')
      .eq('provider_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const accept = async (inviteId: string) => {
    const { error } = await supabase
      .from('open_lead_responses')
      .update({ status: 'available', responded_at: new Date().toISOString() } as any)
      .eq('id', inviteId);
    if (error) {
      toast.error('Não foi possível registrar disponibilidade');
      return;
    }
    toast.success('Disponibilidade enviada ao cliente!');
    load();
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">Pedidos Abertos</h1>
          <p className="text-sm text-muted-foreground">
            Clientes que pediram ajuda ao sistema. Sinalize disponibilidade — sem leilão de preço.
          </p>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Nenhum pedido no momento</p>
            <p className="text-xs text-muted-foreground">
              Mantenha seu perfil completo para receber convites quando clientes pedirem ajuda na sua categoria.
            </p>
          </Card>
        )}

        <div className="space-y-3">
          {items.map((it) => {
            const lead = it.open_lead;
            if (!lead) return null;
            const expired = new Date(lead.expires_at).getTime() < Date.now();
            const accepted = it.status === 'available';
            return (
              <Card key={it.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground">{lead.service_query}</h3>
                    {lead.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{lead.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {lead.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {lead.city}{lead.state ? `/${lead.state}` : ''}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {accepted && <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200">Disponibilidade enviada</Badge>}
                    {expired && !accepted && <Badge variant="outline">Expirado</Badge>}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {!accepted && !expired && (
                    <Button onClick={() => accept(it.id)} size="sm" className="gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Tenho disponibilidade agora
                    </Button>
                  )}
                  {accepted && lead.client_whatsapp && (
                    <Button asChild size="sm" className="gap-2 bg-[#25D366] text-white hover:bg-[#1da851]">
                      <a
                        href={whatsappLink(
                          lead.client_whatsapp,
                          `Olá ${lead.client_name}, vi seu pedido de ${lead.service_query} no Preciso de Um. Tenho disponibilidade — podemos conversar?`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-4 w-4" /> Falar com {lead.client_name}
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardOpenLeadsPage;
