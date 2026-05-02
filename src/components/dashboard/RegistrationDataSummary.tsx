/**
 * RegistrationDataSummary — card de transparência LGPD/Google.
 *
 * Mostra ao próprio usuário um resumo do que foi capturado no momento do
 * cadastro: IP, dispositivo (OS/browser/modelo), e a versão dos Termos
 * vinculada ao aceite. Compõe a página `/dashboard/privacidade`.
 *
 * Tudo é lido via RLS — `owner_reads_snapshot` permite o usuário ver o
 * próprio registro em `registration_snapshots`.
 *
 * Sem PII pesada: latitude/longitude e fingerprint completo NÃO são
 * exibidos aqui. Para o registro completo, há o link
 * `/dashboard/meu-cadastro`.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileLock2, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Snapshot = {
  ip_address: string | null;
  isp: string | null;
  country: string | null;
  region: string | null;
  city_geoip: string | null;
  os_name: string | null;
  os_version: string | null;
  browser_name: string | null;
  browser_version: string | null;
  device_brand: string | null;
  device_model: string | null;
  language: string | null;
  timezone: string | null;
  connection_type: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  captured_at: string;
};

function formatIp(ip: string | null): string {
  if (!ip) return "—";
  // Mascara o último octeto para reduzir exposição visual mantendo identificação ampla.
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.\d+$/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}.•••`;
  // IPv6: mostra só os 4 primeiros grupos
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":") + ":•••";
  return ip;
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
}

export function RegistrationDataSummary({ userId }: { userId: string | null | undefined }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let cancel = false;
    if (!userId) { setLoading(false); setEmpty(true); return; }
    (async () => {
      try {
        const { data: row, error } = await supabase
          .from("registration_snapshots" as any)
          .select(
            "ip_address, isp, country, region, city_geoip, os_name, os_version, browser_name, browser_version, device_brand, device_model, language, timezone, connection_type, terms_version, terms_accepted_at, captured_at"
          )
          .eq("user_id", userId)
          .maybeSingle();
        if (cancel) return;
        if (error) { setEmpty(true); return; }
        if (!row) { setEmpty(true); return; }
        setData(row as unknown as Snapshot);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [userId]);

  if (loading) {
    return (
      <section className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando seu registro técnico…
        </div>
      </section>
    );
  }

  if (empty || !data) {
    return (
      <section className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Registro técnico do cadastro</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Nenhum registro encontrado. Cadastros antigos podem não ter este snapshot.
              Continuamos protegendo seus dados conforme a LGPD.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const device = [data.device_brand, data.device_model].filter(Boolean).join(" ") || "—";
  const os = [data.os_name, data.os_version].filter(Boolean).join(" ") || "—";
  const browser = [data.browser_name, data.browser_version].filter(Boolean).join(" ") || "—";
  const geoip = [data.city_geoip, data.region, data.country].filter(Boolean).join(" / ") || "—";

  return (
    <section className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-accent" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Registro técnico do cadastro</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Transparência LGPD: estes são os metadados capturados quando você concluiu seu cadastro.
            O registro é imutável e usado apenas para auditoria, prevenção de fraudes e conformidade.
          </p>

          <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
            <Row label="Capturado em" value={formatDate(data.captured_at)} />
            <Row label="Versão dos Termos aceita" value={data.terms_version || "—"} mono />
            <Row label="Termos aceitos em" value={formatDate(data.terms_accepted_at)} />
            <Row label="Endereço IP (mascarado)" value={formatIp(data.ip_address)} mono />
            <Row label="Provedor (ISP)" value={data.isp || "—"} />
            <Row label="Localização aproximada (Geo-IP)" value={geoip} />
            <Row label="Tipo de conexão" value={data.connection_type || "—"} mono />
            <Row label="Aparelho" value={device} />
            <Row label="Sistema operacional" value={os} />
            <Row label="Navegador" value={browser} />
            <Row label="Idioma" value={data.language || "—"} mono />
            <Row label="Fuso horário" value={data.timezone || "—"} mono />
          </dl>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Para ver o registro completo (incluindo coordenadas, área e endereço informado),{" "}
            <Link to="/dashboard/meu-cadastro" className="inline-flex items-center gap-1 text-accent hover:underline">
              <FileLock2 className="h-3 w-3" />
              acesse o registro de cadastro
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-foreground ${mono ? "font-mono" : ""} break-all sm:text-right`}>{value}</dd>
    </div>
  );
}
