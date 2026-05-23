import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FIELD_LABELS, type ChangeRequestRow, type ChangeRequestStatus } from '@/lib/sponsorSelfService';

const STATUS_VARIANT: Record<ChangeRequestStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  cancelled: 'outline',
};

const STATUS_LABEL: Record<ChangeRequestStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  cancelled: 'Cancelada',
};

interface Props {
  rows: ChangeRequestRow[];
  onChanged: () => void;
}

const SponsorChangeRequestList = ({ rows, onChanged }: Props) => {
  const cancel = async (id: string) => {
    if (!confirm('Cancelar esta solicitação?')) return;
    const { error } = await supabase.rpc('sponsor_cancel_change_request' as any, { _id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Solicitação cancelada.');
    onChanged();
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de solicitações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhuma solicitação enviada ainda.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de solicitações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r) => {
          const fields = Object.keys(r.changes || {});
          return (
            <div key={r.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {r.status === 'pending' && (
                  <Button size="sm" variant="outline" onClick={() => cancel(r.id)}>
                    Cancelar
                  </Button>
                )}
              </div>
              <div className="mt-2 text-sm">
                <span className="font-medium">Campos: </span>
                {fields.length === 0
                  ? '—'
                  : fields
                      .map((k) => FIELD_LABELS[k as keyof typeof FIELD_LABELS] || k)
                      .join(', ')}
              </div>
              {r.admin_comment && (
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium">Comentário: </span>
                  {r.admin_comment}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default SponsorChangeRequestList;
