import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import AdminNotificationComposer from '@/components/admin/AdminNotificationComposer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Bell, Image, Video, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const AdminNotificationsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const qc = useQueryClient();

  // Get unique sent notifications (grouped by title + target_group + created_at rounded to minute)
  const { data: sentNotifications = [], isLoading } = useQuery({
    queryKey: ['admin-sent-notifications'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .not('target_group' as any, 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      // Group by title + target_group + minute
      const groups = new Map<string, any>();
      (data || []).forEach((n: any) => {
        const minute = n.created_at?.slice(0, 16);
        const key = `${n.title}|${n.target_group}|${minute}`;
        if (!groups.has(key)) {
          groups.set(key, { ...n, recipientCount: 1 });
        } else {
          groups.get(key).recipientCount += 1;
        }
      });
      return Array.from(groups.values());
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async (n: any) => {
      const minute = n.created_at?.slice(0, 16);
      // Delete all notifications with matching title and target_group within same minute
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('title', n.title)
        .eq('target_group' as any, n.target_group)
        .gte('created_at', minute + ':00')
        .lte('created_at', minute + ':59.999999');
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Notificação removida');
      qc.invalidateQueries({ queryKey: ['admin-sent-notifications'] });
    },
  });

  if (loading || isLoading) {
    return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Central de Notificações
          </h1>
          <p className="text-sm text-muted-foreground">Envie notificações ricas com mídia para os usuários cadastrados</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          {/* Composer */}
          <AdminNotificationComposer />

          {/* History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Enviadas Recentemente</CardTitle>
            </CardHeader>
            <CardContent>
              {sentNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma notificação enviada ainda.</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {sentNotifications.map((n: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{n.title}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {n.target_group === 'all' ? 'Todos' : n.target_group === 'client' ? 'Clientes' : n.target_group === 'provider' ? 'Prestadores' : n.target_group}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {n.recipientCount} dest.
                          </Badge>
                        </div>
                        {n.message && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          {n.image_url && <Image className="h-3 w-3 text-muted-foreground" />}
                          {n.video_url && <Video className="h-3 w-3 text-muted-foreground" />}
                          {n.link && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteGroup.mutate(n)}
                        disabled={deleteGroup.isPending}
                        className="shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminNotificationsPage;
