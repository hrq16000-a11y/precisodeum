import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Check } from 'lucide-react';

const SponsorNotificationsPage = () => {
  const { sponsor, loading } = useSponsorAuth();
  const qc = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['sponsor-notifications', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_notifications' as any)
        .select('*')
        .eq('sponsor_id', sponsor!.id)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from('sponsor_notifications' as any)
        .update({ read: true } as any)
        .eq('id', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsor-notifications'] });
      qc.invalidateQueries({ queryKey: ['sponsor-notifications-unread'] });
    },
  });

  if (loading || isLoading) {
    return (
      <SponsorLayout>
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
      </SponsorLayout>
    );
  }

  return (
    <SponsorLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Notificações</h1>

        {notifications && notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((n: any) => (
              <Card key={n.id} className={n.read ? 'opacity-60' : ''}>
                <CardContent className="flex items-start gap-3 py-4">
                  <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${n.read ? 'text-muted-foreground' : 'text-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{n.title}</span>
                      {!n.read && <Badge className="text-[10px]">Nova</Badge>}
                    </div>
                    {n.message && <p className="text-xs text-muted-foreground mt-1">{n.message}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markRead.mutate(n.id)}
                      disabled={markRead.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhuma notificação.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </SponsorLayout>
  );
};

export default SponsorNotificationsPage;
