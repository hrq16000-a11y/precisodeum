/**
 * recordPrivacyEvent — helper que chama o RPC `record_privacy_event`
 * para registrar uma ação de privacidade no histórico imutável do usuário.
 *
 * Usado por:
 *  - Exportação de dados (DashboardPrivacyPage)
 *  - Banner/centro de cookies (consent_change)
 *  - LoginPage (login_blocked) — sem auth.uid(), usa o caminho silent
 */
import { supabase } from "@/integrations/supabase/client";

export type PrivacyEventType =
  | "account_deletion"
  | "data_export"
  | "consent_change"
  | "block_triggered"
  | "block_expired"
  | "login_blocked";

export interface RecordPrivacyEventArgs {
  event_type: PrivacyEventType;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Tenta registrar o evento. Falha silenciosa: o histórico é "best-effort"
 * para não bloquear a ação principal (exportar/excluir/aceitar cookies).
 */
export async function recordPrivacyEvent(
  args: RecordPrivacyEventArgs,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    const { data, error } = await (supabase.rpc as any)("record_privacy_event", {
      _event_type: args.event_type,
      _reason: args.reason ?? null,
      _metadata: args.metadata ?? {},
      _ip_address: null, // server-side preencheria; client envia null
      _user_agent: ua,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: typeof data === "string" ? data : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || "rpc_failed" };
  }
}
