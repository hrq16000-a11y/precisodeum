import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Shield, Mail, Phone, Calendar, UserCheck, Briefcase, FileText, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface UserDetailSheetProps {
  user: any | null;
  isAdmin: boolean;
  onClose: () => void;
}

const UserDetailSheet = ({ user, isAdmin, onClose }: UserDetailSheetProps) => {
  const [services, setServices] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [tab, setTab] = useState('profile');

  useEffect(() => {
    if (!user) return;
    setTab('profile');

    // Fetch services via provider
    supabase.from('providers').select('id').eq('user_id', user.id).then(({ data: provs }) => {
      if (!provs?.length) { setServices([]); setLeads([]); return; }
      const providerIds = provs.map(p => p.id);
      supabase.from('services').select('id, service_name, created_at, deleted_at').in('provider_id', providerIds).order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => setServices(data || []));
      supabase.from('leads').select('id, client_name, status, created_at, service_needed').in('provider_id', providerIds).order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => setLeads(data || []));
    });

    // Fetch audit logs for this user
    supabase.from('audit_log').select('*').eq('resource_id', user.id).eq('resource_type', 'user').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setAuditLogs(data || []));
  }, [user?.id]);

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      update: 'Editado', deactivate: 'Desativado', activate: 'Ativado',
      block: 'Bloqueado', unblock: 'Desbloqueado', make_admin: 'Promovido a Admin',
      reset_password: 'Senha redefinida', soft_delete: 'Soft-deleted',
    };
    return map[action] || action;
  };

  return (
    <Sheet open={!!user} onOpenChange={open => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do Usuário</SheetTitle>
        </SheetHeader>
        {user && (
          <div className="mt-4 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground">
                {(user.full_name || '?')[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-display font-bold text-foreground text-lg">{user.full_name || '—'}</p>
                <div className="flex items-center gap-2 mt-1">
                  {isAdmin && <Badge className="bg-amber-100 text-amber-800 text-[10px]"><Shield className="h-3 w-3 mr-1" /> Admin</Badge>}
                  <Badge variant={user.status === 'inactive' ? 'destructive' : 'default'} className="text-[10px]">
                    {user.status === 'inactive' ? 'Inativo' : 'Ativo'}
                  </Badge>
                </div>
              </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="profile"><UserCheck className="h-3.5 w-3.5 mr-1" />Perfil</TabsTrigger>
                <TabsTrigger value="services"><Briefcase className="h-3.5 w-3.5 mr-1" />Serviços</TabsTrigger>
                <TabsTrigger value="leads"><FileText className="h-3.5 w-3.5 mr-1" />Leads</TabsTrigger>
                <TabsTrigger value="audit"><History className="h-3.5 w-3.5 mr-1" />Histórico</TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-3 mt-3">
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground break-all">{user.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground">{user.phone || user.whatsapp || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground capitalize">{user.profile_type || user.role || 'client'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground">
                      Criado em {user.created_at ? format(new Date(user.created_at), 'dd/MM/yyyy HH:mm') : '—'}
                    </span>
                  </div>
                  {user.user_ref && (
                    <div className="text-xs text-muted-foreground">Ref: {user.user_ref}</div>
                  )}
                </div>
                {user.whatsapp && (
                  <a href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors">
                    <Phone className="h-4 w-4" /> Chamar no WhatsApp
                  </a>
                )}
              </TabsContent>

              {/* Services Tab */}
              <TabsContent value="services" className="mt-3">
                {services.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum serviço vinculado</p>
                ) : (
                  <div className="space-y-2">
                    {services.map(s => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.service_name}</p>
                          <p className="text-xs text-muted-foreground">{s.created_at ? format(new Date(s.created_at), 'dd/MM/yyyy') : ''}</p>
                        </div>
                        {s.deleted_at && <Badge variant="destructive" className="text-[10px]">Excluído</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Leads Tab */}
              <TabsContent value="leads" className="mt-3">
                {leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum lead vinculado</p>
                ) : (
                  <div className="space-y-2">
                    {leads.map(l => (
                      <div key={l.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{l.client_name}</p>
                          <p className="text-xs text-muted-foreground">{l.service_needed || ''} · {l.created_at ? format(new Date(l.created_at), 'dd/MM/yyyy') : ''}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">{l.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Audit Tab */}
              <TabsContent value="audit" className="mt-3">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum registro de auditoria</p>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map(log => (
                      <div key={log.id} className="rounded-lg border border-border p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px]">{actionLabel(log.action)}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {log.created_at ? format(new Date(log.created_at), 'dd/MM/yyyy HH:mm') : ''}
                          </span>
                        </div>
                        {log.details && (
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {log.details.changes && Object.entries(log.details.changes as Record<string, { from: any; to: any }>).map(([field, val]) => (
                              <p key={field}>
                                <span className="font-medium">{field}:</span> {String(val.from)} → {String(val.to)}
                              </p>
                            ))}
                            {log.details.reason && <p>Motivo: {log.details.reason}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default UserDetailSheet;
