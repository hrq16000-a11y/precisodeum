import { Navigate } from 'react-router-dom';
import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSponsorAuth, type SponsorPermissionKey } from '@/hooks/useSponsorAuth';
import { Crown, LockKeyhole } from 'lucide-react';

interface SponsorFeatureGateProps {
  children: React.ReactNode;
  feature?: SponsorPermissionKey;
}

const SponsorFeatureGate = ({ children, feature }: SponsorFeatureGateProps) => {
  const { loading, hasActivePlan, hasSponsorPermission, subscription, isAdmin } = useSponsorAuth(false);

  if (loading) return null;
  if (isAdmin || (hasActivePlan && (!feature || hasSponsorPermission(feature)))) return <>{children}</>;
  if (hasActivePlan && feature && !hasSponsorPermission(feature)) return <Navigate to="/sponsor-panel" replace />;

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
              Este recurso fica disponível apenas para patrocinadores com assinatura ativa. Status atual: {subscription?.status || 'sem assinatura ativa'}.
            </p>
            <Button asChild className="w-full sm:w-auto">
              <a href="/espacos-patrocinio">Ver planos de patrocínio</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </SponsorLayout>
  );
};

export default SponsorFeatureGate;