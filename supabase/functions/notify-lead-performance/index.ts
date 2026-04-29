// notify-lead-performance
// Cron-triggered edge function — varre prestadores que receberam 5+ cliques (whatsapp/phone)
// nas últimas 24h e cria uma notificação in-app de celebração ("Seu trabalho está despertando interesse").
// Throttle: só envia 1 notificação a cada 24h por prestador (chave em notifications.type='lead_performance').

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THRESHOLD = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // 1) Pega contagens das últimas 24h por provider
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("lead_interactions")
      .select("provider_id")
      .in("interaction_type", ["whatsapp", "phone"])
      .gte("created_at", since);

    if (error) throw error;

    const counts = new Map<string, number>();
    for (const r of rows ?? []) {
      const id = (r as { provider_id: string }).provider_id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const eligibleProviderIds = [...counts.entries()]
      .filter(([, c]) => c >= THRESHOLD)
      .map(([id]) => id);

    if (eligibleProviderIds.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, eligible: 0, notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Resolve user_id + cidade dos elegíveis
    const { data: provs } = await supabase
      .from("providers")
      .select("id, user_id, city")
      .in("id", eligibleProviderIds);

    if (!provs || provs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, eligible: 0, notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Filtra os que já receberam essa notificação nas últimas 24h
    const userIds = provs.map((p) => p.user_id);
    const { data: recent } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("type", "lead_performance")
      .in("user_id", userIds)
      .gte("created_at", since);

    const recentSet = new Set((recent ?? []).map((r) => r.user_id));

    // 4) Cria notificações in-app em batch
    const toInsert = provs
      .filter((p) => !recentSet.has(p.user_id))
      .map((p) => {
        const clickCount = counts.get(p.id) ?? 0;
        const cityLabel = p.city ? ` em ${p.city}` : "";
        return {
          user_id: p.user_id,
          title: "Seu trabalho está chamando atenção",
          message:
            `Você recebeu ${clickCount} cliques de contato nas últimas 24h${cityLabel}. ` +
            `Continue com seu perfil atualizado para não perder oportunidades.`,
          type: "lead_performance",
          link: "/dashboard/metrics",
        };
      });

    if (toInsert.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, eligible: provs.length, notified: 0, throttled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insertErr } = await supabase.from("notifications").insert(toInsert);
    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({ ok: true, eligible: provs.length, notified: toInsert.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("notify-lead-performance error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
