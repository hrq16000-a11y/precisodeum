/**
 * PrivacyHistoryTimeline — histórico imutável de ações de privacidade do usuário.
 *
 * Renderizado em /dashboard/privacidade. Mostra, com data/hora ISO, eventos:
 *   - account_deletion → "Pediu exclusão da conta"
 *   - data_export → "Exportou os próprios dados"
 *   - consent_change → "Alterou consentimento de cookies"
 *   - block_triggered / block_expired / login_blocked → eventos de bloqueio
 *
 * Atualiza em tempo real via Realtime (postgres_changes INSERT em
 * user_privacy_history filtrado por user_id). Imutável — apenas leitura.
 */
import { useEffect, useState } from "react";
import {
  History,
  Trash2,
  Download,
  Cookie,
  ShieldAlert,
  ShieldOff,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Event = {
  id: string;
  event_type:
    | "account_deletion"
    | "data_export"
    | "consent_change"
    | "block_triggered"
    | "block_expired"
    | "login_blocked";
  reason: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
};

const LABEL: Record<Event["event_type"], string> = {
  account_deletion: "Pedido de exclusão de conta",
  data_export: "Exportação de dados",
  consent_change: "Alteração de consentimento",
  block_triggered: "Bloqueio aplicado",
  block_expired: "Bloqueio expirado",
  login_blocked: "Login bloqueado",
};

const ICON: Record<Event["event_type"], React.ElementType> = {
  account_deletion: Trash2,
  data_export: Download,
  consent_change: Cookie,
  block_triggered: ShieldAlert,
  block_expired: ShieldOff,
  login_blocked: ShieldAlert,
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function PrivacyHistoryTimeline({
  userId,
}: {
  userId: string | null | undefined;
}) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancel = false;

    const load = async () => {
      const { data } = await supabase
        .from("user_privacy_history")
        .select("id, event_type, reason, metadata, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancel) return;
      setEvents((data ?? []) as Event[]);
      setLoading(false);
    };
    load();

    // Realtime — RLS já garante que o canal só recebe eventos do próprio usuário,
    // mas reforçamos com filter por user_id.
    const ch = supabase
      .channel(`privacy-history-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_privacy_history",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const next = payload?.new as Event | undefined;
          if (next) setEvents((prev) => [next, ...prev].slice(0, 50));
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
          Carregando histórico de privacidade…
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-border/60 bg-card p-4"
      data-testid="privacy-history-timeline"
    >
      <div className="flex items-start gap-3">
        <History className="mt-0.5 h-5 w-5 text-accent" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Histórico de ações de privacidade
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada ação relevante (exclusão, exportação, consentimento e bloqueio) fica
            registrada aqui de forma imutável, com carimbo de data e hora. Atualizamos
            em tempo real.
          </p>

          {events.length === 0 ? (
            <div
              className="mt-3 rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground"
              data-testid="privacy-history-empty"
            >
              Nenhuma ação registrada ainda. Quando você exportar seus dados, alterar
              consentimento ou pedir exclusão, o evento aparecerá aqui.
            </div>
          ) : (
            <ol className="mt-3 space-y-2" data-testid="privacy-history-list">
              {events.map((ev) => {
                const Icon = ICON[ev.event_type] || History;
                return (
                  <li
                    key={ev.id}
                    className="flex items-start gap-2 rounded-md border border-border/40 bg-muted/20 p-2.5 text-xs"
                    data-event-type={ev.event_type}
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold text-foreground">
                          {LABEL[ev.event_type] || ev.event_type}
                        </span>
                        <time
                          className="font-mono text-[10px] text-muted-foreground"
                          dateTime={ev.created_at}
                        >
                          {fmt(ev.created_at)}
                        </time>
                      </div>
                      {ev.reason ? (
                        <p className="mt-0.5 text-muted-foreground">
                          Motivo: <span className="text-foreground">{ev.reason}</span>
                        </p>
                      ) : null}
                      {ev.metadata && Object.keys(ev.metadata).length > 0 ? (
                        <details className="mt-1 text-[11px]">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Detalhes técnicos
                          </summary>
                          <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-[10px] text-muted-foreground">
                            {JSON.stringify(ev.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

export default PrivacyHistoryTimeline;
