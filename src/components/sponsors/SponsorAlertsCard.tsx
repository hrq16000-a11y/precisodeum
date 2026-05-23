import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock, Image as ImageIcon, Inbox } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

interface SponsorLike {
  end_date?: string | null;
  campaign_end?: string | null;
  image_url?: string | null;
  logo_url?: string | null;
  pacing_status?: string | null;
}

interface Props {
  sponsor: SponsorLike;
  pendingCount: number;
}

/** Alertas operacionais simples (sem polling, sem realtime). */
const SponsorAlertsCard = ({ sponsor, pendingCount }: Props) => {
  const alerts: { icon: any; title: string; message: string; tone: 'warn' | 'info' }[] = [];

  const endDate = sponsor.campaign_end || sponsor.end_date;
  if (endDate) {
    const days = differenceInDays(parseISO(endDate), new Date());
    if (days >= 0 && days <= 7) {
      alerts.push({
        icon: Clock,
        title: 'Campanha expirando',
        message: `Sua campanha termina em ${days} dia${days === 1 ? '' : 's'}.`,
        tone: 'warn',
      });
    }
  }

  if (!sponsor.image_url) {
    alerts.push({
      icon: ImageIcon,
      title: 'Banner ausente',
      message: 'Sem banner configurado, a entrega fica limitada.',
      tone: 'warn',
    });
  }

  if (sponsor.pacing_status && sponsor.pacing_status !== 'on_pace' && sponsor.pacing_status !== 'ok') {
    alerts.push({
      icon: AlertTriangle,
      title: 'Pacing crítico',
      message: `Status atual: ${sponsor.pacing_status}.`,
      tone: 'warn',
    });
  }

  if (pendingCount > 0) {
    alerts.push({
      icon: Inbox,
      title: 'Alteração aguardando aprovação',
      message: `${pendingCount} solicitação(ões) pendente(s) na fila do administrador.`,
      tone: 'info',
    });
  }

  if (alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alertas operacionais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((a, i) => {
          const Icon = a.icon;
          return (
            <Alert key={i} variant={a.tone === 'warn' ? 'destructive' : 'default'}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>{a.title}</AlertTitle>
              <AlertDescription>{a.message}</AlertDescription>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default SponsorAlertsCard;
