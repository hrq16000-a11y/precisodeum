import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Eye, MousePointerClick, Image, FileText, Megaphone } from 'lucide-react';
import { SponsorImage } from '@/components/SponsorImage';

const SponsorDashboardPage = () => {
  const { sponsor, sponsorContact, loading } = useSponsorAuth();

  const { data: campaigns } = useQuery({
    queryKey: ['sponsor-campaigns', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_campaigns' as any)
        .select('*')
        .eq('sponsor_id', sponsor!.id);
      return (data || []) as any[];
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ['sponsor-contracts', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_contracts' as any)
        .select('*')
        .eq('sponsor_id', sponsor!.id);
      return (data || []) as any[];
    },
  });

  const { data: notifications } = useQuery({
    queryKey: ['sponsor-notifications-unread', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_notifications' as any)
        .select('*')
        .eq('sponsor_id', sponsor!.id)
        .eq('read', false)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  if (loading) {
    return (
      <SponsorLayout>
        <div className="space-y-4">
          <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}
          </div>
        </div>
      </SponsorLayout>
    );
  }

  const ctr = sponsor?.impressions && sponsor.impressions > 0
    ? ((sponsor.clicks / sponsor.impressions) * 100).toFixed(2)
    : '0.00';

  return (
    <SponsorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Olá, {sponsorContact?.contact_name || sponsor?.title} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Painel do patrocinador — {sponsor?.title}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Impressões</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(sponsor?.impressions || 0).toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cliques</CardTitle>
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(sponsor?.clicks || 0).toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">CTR</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ctr}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Notificações</CardTitle>
              <Megaphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notifications?.length || 0}</div>
              {(notifications?.length || 0) > 0 && (
                <p className="text-xs text-destructive mt-1">não lidas</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Sponsor status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Image className="h-4 w-4" /> Status do Banner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ativo</span>
                <Badge variant={sponsor?.active ? 'default' : 'secondary'}>
                  {sponsor?.active ? 'Sim' : 'Não'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Posição</span>
                <Badge variant="outline">{sponsor?.position || '—'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plano</span>
                <Badge variant="outline" className="capitalize">{sponsor?.tier || '—'}</Badge>
              </div>
              {sponsor?.start_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Período</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(sponsor.start_date).toLocaleDateString('pt-BR')} —{' '}
                    {sponsor.end_date ? new Date(sponsor.end_date).toLocaleDateString('pt-BR') : 'Indefinido'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campaigns summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Megaphone className="h-4 w-4" /> Campanhas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns && campaigns.length > 0 ? (
                <div className="space-y-2">
                  {campaigns.slice(0, 3).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="truncate mr-2">{c.name}</span>
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                        {c.status}
                      </Badge>
                    </div>
                  ))}
                  {campaigns.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{campaigns.length - 3} mais</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma campanha cadastrada.</p>
              )}
            </CardContent>
          </Card>

          {/* Contracts summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" /> Contratos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contracts && contracts.length > 0 ? (
                <div className="space-y-2">
                  {contracts.slice(0, 3).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="truncate mr-2">{c.contract_number || 'Sem número'}</span>
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                        {c.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum contrato registrado.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Banner preview */}
        {sponsor?.image_url && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Preview do Banner Atual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <SponsorImage
                  src={sponsor.image_url}
                  alt={sponsor.title}
                  className="rounded-xl"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SponsorLayout>
  );
};

export default SponsorDashboardPage;
