import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, MessageCircle, Bell, Smartphone, Send, BellRing } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePwaNotifications } from '@/hooks/usePwaNotifications';
import { whatsappLink } from '@/lib/whatsapp';

type ChannelKey = 'email' | 'whatsapp' | 'push' | 'in_app' | 'sms';

const CHANNELS: { key: ChannelKey; label: string; desc: string; icon: any }[] = [
  { key: 'in_app',   label: 'Notificações no app',     desc: 'Ícone de sino dentro do dashboard.',                  icon: Bell },
  { key: 'push',     label: 'Push (PWA)',              desc: 'Notificação no celular mesmo com o app fechado.',      icon: BellRing },
  { key: 'email',    label: 'E-mail',                  desc: 'Resumos e lembretes no seu e-mail cadastrado.',        icon: Mail },
  { key: 'whatsapp', label: 'WhatsApp',                desc: 'Lembretes diretos no WhatsApp do seu perfil.',         icon: MessageCircle },
  { key: 'sms',      label: 'SMS',                     desc: 'Mensagens de texto para o número cadastrado.',         icon: Smartphone },
];

const DEFAULTS: Record<ChannelKey, boolean> = { in_app: true, push: true, email: true, whatsapp: true, sms: false };

const DashboardNotificationPreferencesPage = () => {
  const { user, provider, profile, loading } = useAuth();
  const navigate = useNavigate();
  const pwa = usePwaNotifications();
  const [prefs, setPrefs] = useState<Record<ChannelKey, boolean>>(DEFAULTS);
  const [saving, setSaving] = useState<ChannelKey | null>(null);
  const [testing, setTesting] = useState<ChannelKey | null>(null);

  useEffect(() => { if (!loading && !user) navigate('/login'); }, [loading, user, navigate]);

  useEffect(() => {
    const remote = (provider as any)?.notification_channels as Record<string, boolean> | undefined;
    if (remote) setPrefs({ ...DEFAULTS, ...remote });
  }, [provider]);

  const persist = async (next: Record<ChannelKey, boolean>) => {
    if (!provider?.id) return;
    const { error } = await supabase
      .from('providers')
      .update({ notification_channels: next } as any)
      .eq('id', provider.id);
    if (error) toast.error('Não foi possível salvar', { description: error.message });
  };

  const toggle = async (key: ChannelKey, value: boolean) => {
    setSaving(key);
    const next = { ...prefs, [key]: value };
    setPrefs(next);

    // Push exige permissão do navegador
    if (key === 'push' && value) {
      const granted = await pwa.requestPermission();
      if (!granted) {
        next.push = false;
        setPrefs(next);
        toast.error('Permissão de notificação negada pelo navegador');
        setSaving(null);
        return;
      }
    }
    await persist(next);
    toast.success(`${value ? 'Ativado' : 'Desativado'}: ${CHANNELS.find(c => c.key === key)?.label}`);
    setSaving(null);
  };

  const testChannel = async (key: ChannelKey) => {
    if (!user) return;
    setTesting(key);
    try {
      if (key === 'in_app') {
        const { error } = await supabase.from('notifications').insert({
          user_id: user.id, type: 'system',
          title: 'Teste de notificação', message: 'Se você está vendo isto, o canal in-app está funcionando.',
        } as any);
        if (error) throw error;
        toast.success('Notificação enviada — confira o sino no topo');
      } else if (key === 'push') {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
          toast.error('Permissão de notificação negada — habilite no navegador');
        } else {
          new Notification('Teste de Push', { body: 'Push do PWA funcionando!' });
          toast.success('Push enviado para este dispositivo');
        }
      } else if (key === 'whatsapp') {
        const phone = (provider as any)?.whatsapp || (profile as any)?.whatsapp;
        if (!phone) { toast.error('Sem WhatsApp cadastrado no perfil'); return; }
        window.open(whatsappLink(String(phone), 'Mensagem de teste do Preciso de Um.'), '_blank');
        toast.success('WhatsApp aberto');
      } else if (key === 'email') {
        toast.message('E-mail de teste agendado', { description: `Será enviado para ${user.email} no próximo ciclo de envio.` });
      } else if (key === 'sms') {
        toast.message('SMS ainda em homologação', { description: 'Em breve você poderá testar o envio.' });
      }
    } catch (e: any) {
      toast.error('Falha no teste', { description: e?.message });
    } finally {
      setTesting(null);
    }
  };

  const enabledCount = useMemo(() => Object.values(prefs).filter(Boolean).length, [prefs]);

  return (
    <DashboardLayout>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Preferências de Notificação</h1>
        <p className="mt-1 text-sm text-muted-foreground">{enabledCount} de {CHANNELS.length} canais ativos. Você pode testar cada um individualmente.</p>
      </div>

      <div className="mt-5 space-y-3">
        {CHANNELS.map(({ key, label, desc, icon: Icon }) => {
          const value = !!prefs[key];
          return (
            <div key={key} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <Button size="sm" variant="outline" disabled={!value || testing === key} onClick={() => testChannel(key)} className="gap-1">
                  <Send className="h-3.5 w-3.5" /> {testing === key ? 'Enviando...' : 'Testar envio'}
                </Button>
                <Switch checked={value} disabled={saving === key} onCheckedChange={(v) => toggle(key, v)} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Suas preferências são aplicadas a lembretes de follow-up, novos leads e alertas do sistema. SMS está em homologação e pode não estar disponível no momento.
      </p>
    </DashboardLayout>
  );
};

export default DashboardNotificationPreferencesPage;
