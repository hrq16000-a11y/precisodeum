/**
 * /dashboard/meu-cadastro — Arquivo Morto Jurídico (LGPD).
 *
 * Página somente-leitura, IMUTÁVEL, com o snapshot do momento do cadastro:
 * IP, ISP, geolocalização aproximada e precisa, endereço, dispositivo,
 * navegador, bateria, fonte (Google/email/social/anúncio) e UTMs.
 *
 * Acesso: apenas o próprio dono (RLS) ou admin via SQL.
 *
 * Botão "Solicitar exclusão e ban" aciona a RPC `request_self_account_ban`:
 *  - banimento imediato (`profiles.banned_at`)
 *  - bloqueio de re-cadastro por 90 dias (mesma WhatsApp + e-mail + endereço
 *    + device fingerprint + IP)
 *  - exclusão definitiva agendada para 90 dias depois
 */

import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, FileLock2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { toast } from 'sonner';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DashboardGroupNav from '@/components/dashboard/DashboardGroupNav';

interface Snapshot {
  id: string;
  signup_method: string | null;
  signup_referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  landing_url: string | null;
  came_from_link: boolean | null;
  ip_address: string | null;
  isp: string | null;
  country: string | null;
  region: string | null;
  city_geoip: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  was_moving: boolean | null;
  velocity_mps: number | null;
  postal_code: string | null;
  street: string | null;
  street_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  whatsapp: string | null;
  email: string | null;
  user_agent: string | null;
  device_brand: string | null;
  device_model: string | null;
  device_imei: string | null;
  os_name: string | null;
  os_version: string | null;
  browser_name: string | null;
  browser_version: string | null;
  screen_width: number | null;
  screen_height: number | null;
  device_pixel_ratio: number | null;
  language: string | null;
  timezone: string | null;
  battery_level: number | null;
  battery_charging: boolean | null;
  online_at_signup: boolean | null;
  device_fingerprint: string | null;
  origin_summary: Record<string, unknown> | null;
  captured_at: string;
}

const Row = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="grid grid-cols-[140px_1fr] items-start gap-3 py-1.5 border-b border-border/50 last:border-0">
    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className={`text-sm break-words text-foreground ${mono ? 'font-mono text-xs' : ''}`}>
      {value === null || value === undefined || value === '' ? (
        <span className="italic text-muted-foreground">não informado</span>
      ) : (
        value
      )}
    </span>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border bg-card p-4">
    <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
    <div>{children}</div>
  </section>
);

export default function DashboardMyRegistrationPage() {
  useSeoHead({
    title: 'Meu cadastro (registro imutável) | Preciso de Um',
    description: 'Registro forense imutável do seu cadastro — somente leitura.',
    canonical: `${SITE_BASE_URL}/dashboard/meu-cadastro`,
    noindex: true,
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [banLoading, setBanLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) { setLoading(false); return; }
      const { data, error } = await supabase
        .from('registration_snapshots' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!alive) return;
      if (error) console.warn('[meu-cadastro]', error.message);
      setSnap((data as any) || null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  const handleSelfBan = async () => {
    setBanLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('request_self_account_ban');
      if (error) throw error;
      console.info('[self-ban]', data);
      toast.success('Conta banida e exclusão agendada para 90 dias.', {
        description: 'Você será desconectado agora.',
        duration: 6000,
      });
      await supabase.auth.signOut();
      navigate('/', { replace: true });
    } catch (e: any) {
      toast.error('Não foi possível processar agora.', { description: e?.message });
    } finally {
      setBanLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-6">
        <div className="container max-w-3xl">
          <DashboardGroupNav />

          <header className="mb-5 flex items-start gap-3">
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600">
              <FileLock2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                Meu cadastro <span className="text-muted-foreground">(registro imutável)</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Este é o <strong>arquivo morto jurídico</strong> do seu cadastro: dados capturados
                no momento exato em que você criou a conta. Por exigência legal e de auditoria,
                <strong> esta tela não é editável</strong> e nunca muda.
              </p>
            </div>
          </header>

          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando registro...
            </div>
          ) : !snap ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Não encontramos um registro de cadastro vinculado à sua conta.
            </div>
          ) : (
            <div className="space-y-4">
              <Section title="Origem do cadastro">
                <Row label="Método" value={snap.signup_method} />
                <Row label="Veio por link?" value={snap.came_from_link ? 'Sim' : 'Não'} />
                <Row label="Referrer" value={snap.signup_referrer} mono />
                <Row label="URL de entrada" value={snap.landing_url} mono />
                <Row label="UTM source" value={snap.utm_source} />
                <Row label="UTM medium" value={snap.utm_medium} />
                <Row label="UTM campaign" value={snap.utm_campaign} />
                <Row label="UTM term" value={snap.utm_term} />
                <Row label="UTM content" value={snap.utm_content} />
              </Section>

              <Section title="Rede e provedor">
                <Row label="IP" value={snap.ip_address} mono />
                <Row label="Provedor (ISP)" value={snap.isp} />
                <Row label="País" value={snap.country} />
                <Row label="Região" value={snap.region} />
                <Row label="Cidade (GeoIP)" value={snap.city_geoip} />
              </Section>

              <Section title="Coordenadas precisas declaradas">
                <Row label="Latitude" value={snap.latitude} mono />
                <Row label="Longitude" value={snap.longitude} mono />
                <Row label="Precisão (m)" value={snap.accuracy_m} />
                <Row label="Em movimento?" value={snap.was_moving === null ? null : (snap.was_moving ? 'Sim' : 'Não')} />
                <Row label="Velocidade (m/s)" value={snap.velocity_mps} />
              </Section>

              <Section title="Endereço declarado">
                <Row label="CEP" value={snap.postal_code} />
                <Row label="Rua" value={snap.street} />
                <Row label="Número" value={snap.street_number} />
                <Row label="Bairro" value={snap.neighborhood} />
                <Row label="Cidade" value={snap.city} />
                <Row label="UF" value={snap.state} />
              </Section>

              <Section title="Contato">
                <Row label="WhatsApp" value={snap.whatsapp} />
                <Row label="E-mail" value={snap.email} />
              </Section>

              <Section title="Dispositivo">
                <Row label="User-Agent" value={snap.user_agent} mono />
                <Row label="Marca" value={snap.device_brand} />
                <Row label="Modelo" value={snap.device_model} />
                <Row label="IMEI" value={snap.device_imei || <span className="italic text-muted-foreground">indisponível via web (apenas app nativo)</span>} mono />
                <Row label="Sistema" value={[snap.os_name, snap.os_version].filter(Boolean).join(' ')} />
                <Row label="Navegador" value={[snap.browser_name, snap.browser_version].filter(Boolean).join(' ')} />
                <Row label="Tela" value={snap.screen_width && snap.screen_height ? `${snap.screen_width}×${snap.screen_height} @${snap.device_pixel_ratio}x` : null} />
                <Row label="Idioma" value={snap.language} />
                <Row label="Fuso" value={snap.timezone} />
                <Row label="Fingerprint" value={snap.device_fingerprint} mono />
              </Section>

              <Section title="Estado físico">
                <Row label="Bateria" value={snap.battery_level === null ? null : `${Math.round((snap.battery_level || 0) * 100)}%`} />
                <Row label="Carregando?" value={snap.battery_charging === null ? null : (snap.battery_charging ? 'Sim' : 'Não')} />
                <Row label="Online?" value={snap.online_at_signup === null ? null : (snap.online_at_signup ? 'Sim' : 'Não')} />
                <Row label="Capturado em" value={new Date(snap.captured_at).toLocaleString('pt-BR')} />
              </Section>
            </div>
          )}

          <section className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
              <div className="flex-1">
                <h2 className="text-base font-bold text-destructive">Solicitar exclusão definitiva</h2>
                <p className="mt-1 text-sm text-foreground/90">
                  Ao confirmar, sua conta é <strong>banida imediatamente</strong> e a exclusão
                  definitiva ocorre em <strong>90 dias</strong>. Durante esse período, você
                  <strong> não poderá criar novo cadastro</strong> usando o mesmo WhatsApp,
                  e-mail, endereço, dispositivo ou rede. Após 90 dias, o bloqueio se torna
                  <strong> permanente</strong>.
                </p>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="mt-3" disabled={banLoading}>
                      {banLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Solicitar exclusão e ban
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Tem certeza absoluta?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação <strong>não pode ser desfeita</strong>. Sua conta será banida
                        agora e excluída definitivamente em 90 dias. Você não conseguirá voltar
                        a usar a plataforma com os mesmos dados durante esse período — e depois
                        o bloqueio fica permanente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleSelfBan}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Sim, banir minha conta
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
