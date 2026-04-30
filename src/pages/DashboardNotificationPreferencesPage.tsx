import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, MessageCircle, Bell, Smartphone, Send, BellRing, Activity, Volume2, Flame, MailCheck, Zap } from 'lucide-react';
import { playHornBeep } from '@/lib/soundFx';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePwaNotifications } from '@/hooks/usePwaNotifications';
import { whatsappLink } from '@/lib/whatsapp';
import { useLeadAlertPreference, type LeadAlertMode } from '@/hooks/useLeadAlertPreference';

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

      {/* Alertas de novos leads — modo + intervalo anti-spam */}
      <NewLeadAlertSettings />

      {/* Eventos de Performance */}
      <div className="mt-8">
        <h2 className="font-display text-lg font-bold text-foreground">Eventos de performance</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Controle as notificações relacionadas à sua atividade e visibilidade na busca.
        </p>
      </div>
      <div className="mt-3 space-y-3">
        {([
          { key: 'perf_signal', label: 'Sinal de Vida', desc: 'Lembretes para manter o perfil ativo (visibilidade +25% por 7 dias).', icon: Activity },
          { key: 'perf_ping',   label: 'Ping de Sucesso', desc: 'Toast em tempo real quando alguém clica no seu WhatsApp/telefone.', icon: Flame },
          { key: 'perf_sound',  label: 'Som de buzina',   desc: 'Toca um beep curto junto com o Ping de Sucesso.', icon: Volume2 },
          { key: 'perf_email_5plus', label: 'Resumo de 5+ cliques em 24h', desc: 'Notificação no app quando seu perfil bombar (resumo por cidade).', icon: MailCheck },
        ] as const).map(({ key, label, desc, icon: Icon }) => {
          const value = (prefs as any)[key] ?? true;
          return (
            <div key={key} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${value ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                {key === 'perf_sound' && (
                  <Button size="sm" variant="outline" onClick={() => playHornBeep()} className="gap-1">
                    <Volume2 className="h-3.5 w-3.5" /> Testar som
                  </Button>
                )}
                <Switch
                  checked={value}
                  disabled={saving === (key as any)}
                  onCheckedChange={async (v) => {
                    setSaving(key as any);
                    const next = { ...prefs, [key]: v } as Record<string, boolean>;
                    setPrefs(next as any);
                    await persist(next as any);
                    toast.success(`${v ? 'Ativado' : 'Desativado'}: ${label}`);
                    setSaving(null);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Suas preferências são aplicadas a lembretes de follow-up, novos leads, alertas do sistema e eventos de performance. SMS está em homologação e pode não estar disponível no momento.
      </p>
    </DashboardLayout>
  );
};

/**
 * Configurações avançadas para alertas de novos leads em tempo real:
 * - Tipo de alerta: silencioso, só som, só toast ou ambos.
 * - Intervalo anti-spam: tempo mínimo entre dois alertas consecutivos
 *   para evitar enxurrada quando vários leads chegam em rajada.
 */
function NewLeadAlertSettings() {
  const { mode, setMode, minIntervalSeconds, setMinIntervalSeconds, loading } = useLeadAlertPreference();

  const MODES: { key: LeadAlertMode; label: string; desc: string }[] = [
    { key: 'both',  label: 'Toast + Bip', desc: 'Notificação visual e som curto (recomendado).' },
    { key: 'sound', label: 'Apenas bip',  desc: 'Som curto, sem notificação visual.' },
    { key: 'toast', label: 'Apenas toast', desc: 'Notificação visual silenciosa.' },
    { key: 'off',   label: 'Silencioso',   desc: 'Nenhum alerta — apenas atualiza a lista.' },
  ];

  const INTERVALS = [0, 15, 30, 60, 120, 300];

  return (
    <>
      <div className="mt-8">
        <h2 className="font-display text-lg font-bold text-foreground">Alertas de novos leads</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Como você quer ser avisado quando um novo lead chegar em tempo real.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MODES.map(({ key, label, desc }) => {
          const active = mode === key;
          return (
            <button
              key={key}
              type="button"
              disabled={loading}
              onClick={() => setMode(key)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                active
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                  : 'border-border bg-card hover:border-primary/40'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Intervalo anti-spam</p>
            <p className="text-xs text-muted-foreground">
              Tempo mínimo entre dois alertas. Útil quando leads chegam em rajada.
            </p>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
            {minIntervalSeconds === 0 ? 'desligado' : `${minIntervalSeconds}s`}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERVALS.map((sec) => {
            const active = minIntervalSeconds === sec;
            return (
              <button
                key={sec}
                type="button"
                disabled={loading || mode === 'off'}
                onClick={() => setMinIntervalSeconds(sec)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                }`}
              >
                {sec === 0 ? 'Sem limite' : `${sec}s`}
              </button>
            );
          })}
        </div>

        {/* Resumo claro das regras vigentes */}
        <div className="mt-3 rounded-lg border border-dashed border-border/70 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Como funciona agora:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>
              {mode === 'off'
                ? 'Modo silencioso ativo — nenhum alerta visual ou sonoro será emitido.'
                : mode === 'sound'
                ? 'Apenas o bip toca. Sem toast visual.'
                : mode === 'toast'
                ? 'Apenas o toast aparece. Sem som.'
                : 'Toast + bip a cada novo lead.'}
            </li>
            <li>
              {minIntervalSeconds === 0
                ? 'Sem janela anti-spam — todo lead novo gera alerta imediatamente.'
                : `Após um alerta, os próximos ficam suprimidos por ${minIntervalSeconds}s. A lista continua atualizada em tempo real.`}
            </li>
            <li>O sino e a inbox sempre recebem a notificação, mesmo em modo silencioso.</li>
          </ul>
        </div>

        {mode === 'off' && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            O modo silencioso ignora o intervalo — nenhum alerta será emitido.
          </p>
        )}
      </div>

      <RecentLeadsHistory />
    </>
  );
}

export default DashboardNotificationPreferencesPage;
