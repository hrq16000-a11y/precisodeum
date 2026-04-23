import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSponsorAuth, type SponsorPermissionKey } from '@/hooks/useSponsorAuth';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Crown, LockKeyhole, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface SponsorFeatureGateProps {
  children: React.ReactNode;
  feature?: SponsorPermissionKey;
}

const SponsorFeatureGate = ({ children, feature }: SponsorFeatureGateProps) => {
  const { loading, hasActivePlan, hasSponsorPermission, subscription, isAdmin, sponsor, refetch } = useSponsorAuth(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || hasActivePlan || isAdmin || !sponsor?.id) return;
    supabase.rpc('log_sponsor_access_event' as any, {
      _sponsor_id: sponsor.id,
      _event_type: 'blocked_access',
      _resource_path: location.pathname,
      _details: { feature: feature || 'active_plan' },
    } as any).then(() => undefined);
  }, [feature, hasActivePlan, isAdmin, loading, location.pathname, sponsor?.id]);

  if (loading) return null;
  if (isAdmin || (hasActivePlan && (!feature || hasSponsorPermission(feature)))) return <>{children}</>;
  if (hasActivePlan && feature && !hasSponsorPermission(feature)) {
    toast.warning('Seu plano não inclui este recurso. Você voltou para a visão geral.');
    navigate('/sponsor-panel', { replace: true, state: { sponsorAccess: 'missing_permission', feature } });
    return null;
  }

  const refreshStatus = async () => {
    await refetch();
    if (sponsor?.id) {
      await supabase.rpc('log_sponsor_access_event' as any, {
        _sponsor_id: sponsor.id,
        _event_type: 'subscription_refresh',
        _resource_path: location.pathname,
        _details: { source: 'blocked_gate' },
      } as any);
    }
    toast.success('Status da assinatura reconsultado');
  };

  return (
    <SponsorLayout>
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <Badge variant="outline" className="mb-2 w-fit gap-1">
              <LockKeyhole className="h-3 w-3" /> Acesso bloqueado
            </Badge>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Crown className="h-5 w-5 text-primary" /> Plano ativo necessário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este recurso fica disponível apenas com assinatura ativa. Status atual: {subscription?.status || 'sem assinatura ativa'}.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="w-full sm:w-auto">
                <Link to="/espacos-patrocinio">Ver planos de patrocínio</Link>
              </Button>
              <Button variant="outline" className="w-full gap-2 sm:w-auto" onClick={refreshStatus}>
                <RefreshCw className="h-4 w-4" /> Atualizar status
              </Button>
              <Button variant="ghost" className="w-full gap-2 sm:w-auto" onClick={() => navigate('/sponsor-panel', { replace: true })}>
                <ArrowLeft className="h-4 w-4" /> Voltar ao painel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SponsorLayout>
  );
};

export default SponsorFeatureGate;