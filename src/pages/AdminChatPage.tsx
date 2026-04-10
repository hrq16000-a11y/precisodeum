import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Settings, Users, Shield, Trash2, Eye, Lock, Unlock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';

const PROFILE_TYPES = [
  { key: 'provider', label: 'Profissional' },
  { key: 'rh', label: 'RH / Agência' },
  { key: 'client', label: 'Cliente' },
];

const AdminChatPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const qc = useQueryClient();

  // Settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['admin-chat-settings'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await (supabase.from('chat_settings' as any).select('*').limit(1).single() as any);
      return data as any;
    },
  });

  const [localSettings, setLocalSettings] = useState<any>(null);
  const activeSettings = localSettings || settings;

  const updateField = (key: string, value: any) => {
    setLocalSettings((prev: any) => ({ ...(prev || settings), [key]: value }));
  };

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!activeSettings?.id) return;
      const { error } = await (supabase
        .from('chat_settings' as any)
        .update({
          enabled: activeSettings.enabled,
          allowed_profile_types: activeSettings.allowed_profile_types,
          min_services: activeSettings.min_services,
          min_portfolio_albums: activeSettings.min_portfolio_albums,
          blocked_message: activeSettings.blocked_message,
          welcome_message: activeSettings.welcome_message,
          max_message_length: activeSettings.max_message_length,
          allow_images: activeSettings.allow_images,
        } as any)
        .eq('id', activeSettings.id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configurações salvas');
      qc.invalidateQueries({ queryKey: ['admin-chat-settings'] });
      qc.invalidateQueries({ queryKey: ['chat-settings'] });
      setLocalSettings(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ['admin-chat-conversations'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await (supabase
        .from('chat_conversations' as any)
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(100) as any);
      return (data || []) as any[];
    },
  });

  // Get all profiles for conversation participants
  const allParticipants = conversations.flatMap((c: any) => [c.participant_a, c.participant_b]);
  const uniqueParticipants = [...new Set(allParticipants)];

  const { data: participantProfiles = [] } = useQuery({
    queryKey: ['admin-chat-profiles', uniqueParticipants.join(',')],
    enabled: uniqueParticipants.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', uniqueParticipants);
      return (data || []) as any[];
    },
  });

  const profileMap = new Map(participantProfiles.map((p: any) => [p.id, p]));

  const [viewConvId, setViewConvId] = useState<string | null>(null);

  const { data: viewMessages = [] } = useQuery({
    queryKey: ['admin-chat-messages', viewConvId],
    enabled: !!viewConvId,
    queryFn: async () => {
      const { data } = await (supabase
        .from('chat_messages' as any)
        .select('*')
        .eq('conversation_id', viewConvId!)
        .order('created_at', { ascending: true })
        .limit(200) as any);
      return (data || []) as any[];
    },
  });

  const toggleBlock = useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      const { error } = await (supabase
        .from('chat_conversations' as any)
        .update({ blocked: !blocked } as any)
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conversa atualizada');
      qc.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('chat_conversations' as any).delete().eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conversa removida');
      qc.invalidateQueries({ queryKey: ['admin-chat-conversations'] });
      setViewConvId(null);
    },
  });

  if (adminLoading || settingsLoading) {
    return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;
  }

  const toggleProfileType = (typeKey: string) => {
    const current: string[] = activeSettings?.allowed_profile_types || [];
    const next = current.includes(typeKey)
      ? current.filter((t: string) => t !== typeKey)
      : [...current, typeKey];
    updateField('allowed_profile_types', next);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Gestão do Chat
          </h1>
          <p className="text-sm text-muted-foreground">Configure e gerencie o chat entre profissionais</p>
        </div>

        <Tabs defaultValue="settings">
          <TabsList>
            <TabsTrigger value="settings" className="gap-1"><Settings className="h-3.5 w-3.5" /> Configurações</TabsTrigger>
            <TabsTrigger value="conversations" className="gap-1"><Users className="h-3.5 w-3.5" /> Conversas ({conversations.length})</TabsTrigger>
          </TabsList>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Regras de Acesso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Chat Ativado</Label>
                    <p className="text-xs text-muted-foreground">Habilitar ou desabilitar o chat globalmente</p>
                  </div>
                  <Switch
                    checked={activeSettings?.enabled ?? true}
                    onCheckedChange={v => updateField('enabled', v)}
                  />
                </div>

                {/* Profile types */}
                <div>
                  <Label className="text-sm font-medium">Perfis Permitidos</Label>
                  <p className="text-xs text-muted-foreground mb-2">Quais tipos de perfil podem usar o chat</p>
                  <div className="flex gap-3">
                    {PROFILE_TYPES.map(pt => (
                      <label key={pt.key} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={(activeSettings?.allowed_profile_types || []).includes(pt.key)}
                          onCheckedChange={() => toggleProfileType(pt.key)}
                        />
                        <span className="text-sm">{pt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Min services */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm">Mínimo de Serviços</Label>
                    <Input
                      type="number"
                      min={0}
                      value={activeSettings?.min_services ?? 3}
                      onChange={e => updateField('min_services', parseInt(e.target.value) || 0)}
                      className="h-9 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Mínimo de Álbuns de Portfólio</Label>
                    <Input
                      type="number"
                      min={0}
                      value={activeSettings?.min_portfolio_albums ?? 1}
                      onChange={e => updateField('min_portfolio_albums', parseInt(e.target.value) || 0)}
                      className="h-9 mt-1"
                    />
                  </div>
                </div>

                {/* Max message length */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm">Tamanho Máximo da Mensagem</Label>
                    <Input
                      type="number"
                      min={50}
                      max={5000}
                      value={activeSettings?.max_message_length ?? 1000}
                      onChange={e => updateField('max_message_length', parseInt(e.target.value) || 1000)}
                      className="h-9 mt-1"
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-auto">
                    <Switch
                      checked={activeSettings?.allow_images ?? true}
                      onCheckedChange={v => updateField('allow_images', v)}
                    />
                    <Label className="text-sm">Permitir Imagens</Label>
                  </div>
                </div>

                {/* Messages */}
                <div>
                  <Label className="text-sm">Mensagem de Bloqueio</Label>
                  <Textarea
                    value={activeSettings?.blocked_message || ''}
                    onChange={e => updateField('blocked_message', e.target.value)}
                    className="mt-1 text-sm min-h-[60px]"
                    placeholder="Mensagem exibida quando o usuário não é elegível"
                  />
                </div>

                <div>
                  <Label className="text-sm">Mensagem de Boas-Vindas</Label>
                  <Textarea
                    value={activeSettings?.welcome_message || ''}
                    onChange={e => updateField('welcome_message', e.target.value)}
                    className="mt-1 text-sm min-h-[60px]"
                    placeholder="Texto exibido no topo da tela de chat"
                  />
                </div>

                <Button
                  onClick={() => saveSettings.mutate()}
                  disabled={saveSettings.isPending}
                  className="gap-2"
                >
                  {saveSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONVERSATIONS TAB */}
          <TabsContent value="conversations" className="space-y-4 mt-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              {/* List */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Conversas</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[500px] overflow-y-auto space-y-1 p-2">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa</p>
                  ) : conversations.map((conv: any) => {
                    const a = profileMap.get(conv.participant_a);
                    const b = profileMap.get(conv.participant_b);
                    return (
                      <div
                        key={conv.id}
                        className={`flex items-center gap-2 rounded-lg p-2 cursor-pointer transition-colors ${viewConvId === conv.id ? 'bg-primary/10' : 'hover:bg-muted'}`}
                        onClick={() => setViewConvId(conv.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {a?.full_name || 'Usuário'} ↔ {b?.full_name || 'Usuário'}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">{conv.last_message_text}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {conv.blocked && <Badge variant="destructive" className="text-[9px]">Bloqueada</Badge>}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => { e.stopPropagation(); toggleBlock.mutate({ id: conv.id, blocked: conv.blocked }); }}
                          >
                            {conv.blocked ? <Unlock className="h-3.5 w-3.5 text-green-600" /> : <Lock className="h-3.5 w-3.5 text-amber-500" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => { e.stopPropagation(); if (confirm('Excluir conversa e todas as mensagens?')) deleteConversation.mutate(conv.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Message viewer */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Visualizar Mensagens
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-[500px] overflow-y-auto space-y-2">
                  {!viewConvId ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Selecione uma conversa</p>
                  ) : viewMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem mensagens</p>
                  ) : viewMessages.map((msg: any) => {
                    const sender = profileMap.get(msg.sender_id);
                    return (
                      <div key={msg.id} className="rounded-lg border border-border p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{sender?.full_name || 'Usuário'}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        {msg.image_url && <img src={msg.image_url} alt="" className="rounded max-h-32 object-cover mb-1" />}
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminChatPage;
