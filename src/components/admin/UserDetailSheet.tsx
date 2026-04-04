import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Shield, Mail, Phone, Calendar, UserCheck, Briefcase, FileText, History, ImageIcon, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';

interface UserDetailSheetProps {
  user: any | null;
  isAdmin: boolean;
  onClose: () => void;
}

const UserDetailSheet = ({ user, isAdmin, onClose }: UserDetailSheetProps) => {
  const [services, setServices] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [pageSettings, setPageSettings] = useState<any>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [tab, setTab] = useState('profile');
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>({});

  useEffect(() => {
    if (!user) return;
    setTab('profile');
    setPageSettings(null);
    setProviderId(null);

    // Fetch services via provider
    supabase.from('providers').select('id').eq('user_id', user.id).then(({ data: provs }) => {
      if (!provs?.length) { setServices([]); setLeads([]); setProviderId(null); return; }
      const pid = provs[0].id;
      setProviderId(pid);
      const providerIds = provs.map(p => p.id);
      supabase.from('services').select('id, service_name, created_at, deleted_at').in('provider_id', providerIds).order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => setServices(data || []));
      supabase.from('leads').select('id, client_name, status, created_at, service_needed').in('provider_id', providerIds).order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => setLeads(data || []));
      // Fetch page settings
      supabase.from('provider_page_settings').select('*').eq('provider_id', pid).maybeSingle()
        .then(({ data }) => {
          setPageSettings(data);
          if (data) setSettingsForm({ headline: data.headline || '', tagline: data.tagline || '', cta_text: data.cta_text || '', theme: data.theme || 'default', accent_color: data.accent_color || '' });
        });
    });

    // Fetch media by user_ref
    if (user.user_ref) {
      supabase.from('media').select('id, original_name, public_url, entity_type, mime_type, created_at, is_active')
        .eq('user_ref', user.user_ref).order('created_at', { ascending: false }).limit(50)
        .then(({ data }) => setMedia(data || []));
    } else {
      setMedia([]);
    }

    // Fetch audit logs for this user
    supabase.from('audit_log').select('*').eq('resource_id', user.id).eq('resource_type', 'user').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setAuditLogs(data || []));
  }, [user?.id]);

  const savePageSettings = async () => {
    if (!providerId) return;
    const payload = { ...settingsForm, provider_id: providerId };
    let error;
    if (pageSettings?.id) {
      ({ error } = await supabase.from('provider_page_settings').update(payload).eq('id', pageSettings.id));
    } else {
      ({ error } = await supabase.from('provider_page_settings').insert(payload));
    }
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else {
      toast.success('Configurações da página salvas');
      await logAuditAction({ action: 'update', resource_type: 'provider_page_settings', resource_id: providerId, details: settingsForm });
      setEditingSettings(false);
    }
  };

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
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (user.full_name || '?')[0]?.toUpperCase()
                )}
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
              <TabsList className="w-full grid grid-cols-6">
                <TabsTrigger value="profile"><UserCheck className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="services"><Briefcase className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="leads"><FileText className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="media"><ImageIcon className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="page"><Settings className="h-3.5 w-3.5" /></TabsTrigger>
                <TabsTrigger value="audit"><History className="h-3.5 w-3.5" /></TabsTrigger>
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
                <p className="text-xs text-muted-foreground mb-2">{services.length} serviço(s)</p>
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
                <p className="text-xs text-muted-foreground mb-2">{leads.length} lead(s)</p>
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

              {/* Media Tab */}
              <TabsContent value="media" className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">{media.length} arquivo(s)</p>
                {media.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma mídia vinculada</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {media.map(m => (
                      <div key={m.id} className="relative rounded-lg border border-border overflow-hidden group">
                        {m.mime_type?.startsWith('image/') ? (
                          <img src={m.public_url} alt={m.original_name} className="w-full h-20 object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-20 bg-muted flex items-center justify-center text-xs text-muted-foreground">
                            {m.mime_type?.split('/')[1] || 'file'}
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-background/80 px-1 py-0.5">
                          <p className="text-[9px] text-foreground truncate">{m.original_name}</p>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[8px]">{m.entity_type}</Badge>
                            {!m.is_active && <Badge variant="destructive" className="text-[8px]">Inativo</Badge>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Page Settings Tab */}
              <TabsContent value="page" className="mt-3">
                {!providerId ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Usuário não é prestador</p>
                ) : !pageSettings && !editingSettings ? (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Nenhuma configuração de página</p>
                    <Button size="sm" variant="outline" onClick={() => { setEditingSettings(true); setSettingsForm({ headline: '', tagline: '', cta_text: 'Solicitar Orçamento', theme: 'default', accent_color: '' }); }}>
                      Criar configuração
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Headline</Label>
                      <Input value={settingsForm.headline || ''} onChange={e => setSettingsForm({ ...settingsForm, headline: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Tagline</Label>
                      <Input value={settingsForm.tagline || ''} onChange={e => setSettingsForm({ ...settingsForm, tagline: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">CTA Text</Label>
                      <Input value={settingsForm.cta_text || ''} onChange={e => setSettingsForm({ ...settingsForm, cta_text: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Tema</Label>
                        <Input value={settingsForm.theme || ''} onChange={e => setSettingsForm({ ...settingsForm, theme: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">Cor Accent</Label>
                        <Input value={settingsForm.accent_color || ''} onChange={e => setSettingsForm({ ...settingsForm, accent_color: e.target.value })} className="h-8 text-sm" placeholder="#FF6600" />
                      </div>
                    </div>
                    <Button size="sm" onClick={savePageSettings}>Salvar Configurações</Button>
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
