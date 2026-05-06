import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SponsorImage } from '@/components/SponsorImage';

const SponsorBannersPage = () => {
  const { sponsor, loading } = useSponsorAuth();

  // For now sponsor has a single banner; future: multiple banners per sponsor
  if (loading) {
    return (
      <SponsorLayout>
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
      </SponsorLayout>
    );
  }

  return (
    <SponsorLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Meus Banners</h1>

        {sponsor?.image_url ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{sponsor.title}</CardTitle>
                <Badge variant={sponsor.active ? 'default' : 'secondary'}>
                  {sponsor.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <SponsorImage
                  src={sponsor.image_url}
                  alt={sponsor.title}
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Posição:</span>{' '}
                  <Badge variant="outline" className="ml-1">{sponsor.position}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Tier:</span>{' '}
                  <Badge variant="outline" className="ml-1 capitalize">{sponsor.tier}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Link:</span>{' '}
                  {sponsor.link_url ? (
                    <a href={sponsor.link_url} target="_blank" rel="noopener noreferrer" className="text-primary underline ml-1 text-xs break-all">
                      {sponsor.link_url}
                    </a>
                  ) : <span className="text-xs text-muted-foreground ml-1">Nenhum</span>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Para alterar a arte ou o link de destino do banner, entre em contato com a equipe administrativa.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhum banner cadastrado.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </SponsorLayout>
  );
};

export default SponsorBannersPage;
