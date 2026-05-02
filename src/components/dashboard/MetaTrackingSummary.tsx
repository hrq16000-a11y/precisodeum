/**
 * MetaTrackingSummary — "Seus Registros de Segurança"
 *
 * Mostra ao próprio profissional, em /dashboard/privacidade, os campos
 * coletados em `providers.meta_tracking` (JSONB):
 *  - attribution: referrer_kind + UTM
 *  - network: type, downlink, rtt
 *  - movement: was_moving, velocity
 *  - terms: versão e data de aceite
 *
 * Lê via RLS (provider só lê o próprio registro).
 */
import { useEffect, useState } from "react";
import { Activity, Compass, Globe2, Loader2, ShieldCheck, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type MetaTracking = {
  attribution?: {
    referrer_kind?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    came_from_link?: string | null;
  } | null;
  network?: {
    type?: string | null;
    downlink_mbps?: number | null;
    rtt_ms?: number | null;
  } | null;
  movement?: {
    was_moving?: boolean | null;
    velocity_mps?: number | null;
    accuracy_m?: number | null;
  } | null;
  terms?: {
    version?: string | null;
    accepted_at?: string | null;
    accepted?: boolean | null;
  } | null;
};

const REFERRER_LABEL: Record<string, string> = {
  "organic:google": "Busca orgânica (Google)",
  "organic:bing": "Busca orgânica (Bing)",
  "social:instagram": "Instagram",
  "social:facebook": "Facebook",
  "social:whatsapp": "WhatsApp",
  "social:tiktok": "TikTok",
  "social:linkedin": "LinkedIn",
  direct: "Acesso direto",
  email: "E-mail",
  other: "Outra origem",
  unknown: "Origem não identificada",
};

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
}

export function MetaTrackingSummary({ userId }: { userId: string | null | undefined }) {
  const [data, setData] = useState<MetaTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    if (!userId) { setLoading(false); setEmpty(true); return; }

    const load = async () => {
      const { data: row, error } = await supabase
        .from("providers")
        .select("meta_tracking, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancel) return;
      if (error || !row?.meta_tracking) {
        setEmpty(true);
        setLoading(false);
        return;
      }
      setData(row.meta_tracking as MetaTracking);
      setUpdatedAt((row as any).updated_at ?? null);
      setEmpty(false);
      setLoading(false);
    };

    load();

    // Realtime: reflete novas coletas/atualizações de meta_tracking imediatamente
    const ch = supabase
      .channel(`meta-tracking-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "providers", filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const next = payload?.new?.meta_tracking;
          if (next) {
            setData(next as MetaTracking);
            setUpdatedAt(payload?.new?.updated_at ?? new Date().toISOString());
            setEmpty(false);
          }
        },
      )
      .subscribe();

    return () => {
      cancel = true;
      supabase.removeChannel(ch);
    };
  }, [userId]);

  if (loading) {
    return (
      <section className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando seus registros de segurança…
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
            <h3 className="text-sm font-semibold text-foreground">
              Seus Registros de Segurança
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Ainda não temos dados estendidos sobre seu cadastro. Cadastros antigos
              podem não ter este registro adicional.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const attribution = data.attribution || {};
  const network = data.network || {};
  const movement = data.movement || {};
  const terms = data.terms || {};

  const referrer = attribution.referrer_kind || "unknown";
  const referrerLabel = REFERRER_LABEL[referrer] || referrer;

  return (
    <section
      className="rounded-xl border border-border/60 bg-card p-4"
      data-testid="meta-tracking-summary"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-accent" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Seus Registros de Segurança
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Estes são os metadados estendidos coletados quando você criou sua conta.
            Ficam imutáveis e são usados apenas para auditoria, prevenção de fraudes e
            conformidade com a LGPD.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Card icon={Globe2} title="Origem do tráfego">
              <Row label="Como chegou" value={referrerLabel} />
              <Row label="UTM source" value={attribution.utm_source || "—"} mono />
              <Row label="UTM campaign" value={attribution.utm_campaign || "—"} mono />
            </Card>

            <Card icon={Wifi} title="Conexão no cadastro">
              <Row label="Tipo" value={(network.type || "—").toString()} mono />
              <Row
                label="Velocidade"
                value={network.downlink_mbps != null ? `${network.downlink_mbps} Mbps` : "—"}
              />
              <Row
                label="Latência"
                value={network.rtt_ms != null ? `${network.rtt_ms} ms` : "—"}
              />
            </Card>

            <Card icon={Activity} title="Movimento detectado">
              <Row
                label="Em campo no cadastro"
                value={movement.was_moving === true ? "Sim" : movement.was_moving === false ? "Não" : "—"}
              />
              <Row
                label="Velocidade GPS"
                value={movement.velocity_mps != null ? `${movement.velocity_mps.toFixed(1)} m/s` : "—"}
              />
              <Row
                label="Precisão GPS"
                value={movement.accuracy_m != null ? `± ${Math.round(movement.accuracy_m)} m` : "—"}
              />
            </Card>

            <Card icon={Compass} title="Termos vinculados">
              <Row label="Versão aceita" value={terms.version || "—"} mono />
              <Row label="Aceito em" value={fmtDate(terms.accepted_at)} />
              <Row
                label="Status"
                value={terms.accepted ? "Aceito" : "—"}
              />
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <Icon className="h-3.5 w-3.5 text-accent" />
        {title}
      </div>
      <dl className="space-y-1 text-[11px]">{children}</dl>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-foreground ${mono ? "font-mono" : ""} text-right break-all`}>
        {value}
      </dd>
    </div>
  );
}

export default MetaTrackingSummary;
