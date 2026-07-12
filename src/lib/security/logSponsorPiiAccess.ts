/**
 * logSponsorPiiAccess — chame ANTES/DEPOIS de exibir CNPJ, e-mail, telefone
 * ou WhatsApp de patrocinadores em painéis administrativos, para popular a
 * trilha `sponsor_pii_access_log` (visível apenas para admins).
 *
 * Se a RPC não estiver disponível ou o usuário não for admin/dono do sponsor,
 * a chamada falha silenciosamente — nunca deve bloquear a UI.
 */
import { supabase } from "@/integrations/supabase/client";

export type SponsorPiiColumn = "cnpj" | "email" | "phone" | "whatsapp";

export interface LogSponsorPiiAccessInput {
  sponsorId: string;
  columns: SponsorPiiColumn[];
  reason?: string;
  source?: string;
}

export async function logSponsorPiiAccess({
  sponsorId,
  columns,
  reason,
  source = "admin_panel",
}: LogSponsorPiiAccessInput): Promise<void> {
  if (!sponsorId || columns.length === 0) return;
  try {
    // Cast necessário até o supabase-types regenerar após a migração.
    await (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: unknown }>)("log_sponsor_pii_access", {
      _sponsor_id: sponsorId,
      _accessed_columns: columns,
      _reason: reason ?? null,
      _source: source,
    });
  } catch {
    // silencioso — auditoria nunca deve quebrar a UI.
  }
}
