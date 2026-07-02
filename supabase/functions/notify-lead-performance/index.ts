// notify-lead-performance
// Cron-triggered edge function — varre prestadores que receberam 5+ cliques (whatsapp/phone)
// nas últimas 24h e cria uma notificação in-app de celebração ("Seu trabalho está chamando atenção"),
// com resumo por cidade. Respeita providers.notification_channels.perf_email_5plus (default: true).
// Throttle: só envia 1 notificação a cada 24h por prestador (chave em notifications.type='lead_performance').

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { validateCronRequest } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THRESHOLD = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authError = validateCronRequest(req);
  if (authError) return authError;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1) Pega contagens das últimas 24h por provider, com cidade do lead (se houver)
    const { data: rows, error } = await supabase
      .from("lead_interactions")
      .select("provider_id, lead_city")
      .in("interaction_type", ["whatsapp", "phone"])
      .gte("created_at", since);

    if (error) throw error;

    // counts: provider_id -> total
    // perCity: provider_id -> { city -> count }
    const counts = new Map<string, number>();
    const perCity = new Map<string, Map<string, number>>();
    for (const r of rows ?? []) {
      const id = (r as { provider_id: string }).provider_id;
      const city = ((r as any).lead_city as string | null) || "";
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (city) {
        if (!perCity.has(id)) perCity.set(id, new Map());
        const m = perCity.get(id)!;
        m.set(city, (m.get(city) ?? 0) + 1);
      }
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

    // 2) Resolve user_id + cidade + prefs
    const { data: provs } = await supabase
      .from("providers")
      .select("id, user_id, city, notification_channels")
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

    // 4) Cria notificações in-app em batch (respeitando perf_email_5plus)
    const toInsert: Array<Record<string, unknown>> = [];
    let optedOut = 0;
    for (const p of provs) {
      if (recentSet.has(p.user_id)) continue;

      const nc = ((p as any).notification_channels ?? {}) as Record<string, boolean>;
      const enabled = nc.perf_email_5plus !== false; // default ON
      if (!enabled) {
        optedOut++;
        continue;
      }

      const clickCount = counts.get(p.id) ?? 0;

      // Resumo por cidade (top 3)
      const cityMap = perCity.get(p.id);
      const cityList = cityMap
        ? [...cityMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([city, n]) => `${city} (${n})`)
        : [];

      const cityLabel = cityList.length > 0
        ? ` Origens: ${cityList.join(", ")}.`
        : (p.city ? ` Origem provável: ${p.city}.` : "");

      toInsert.push({
        user_id: p.user_id,
        title: "Seu trabalho está chamando atenção",
        message:
          `Você recebeu ${clickCount} cliques de contato nas últimas 24h.${cityLabel} ` +
          `Mantenha seu perfil atualizado (foto, áreas de atendimento e WhatsApp) para continuar bombando.`,
        type: "lead_performance",
        link: "/dashboard/metrics",
      });
    }

    if (toInsert.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, eligible: provs.length, notified: 0, optedOut, throttled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insertErr } = await supabase.from("notifications").insert(toInsert);
    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({ ok: true, eligible: provs.length, notified: toInsert.length, optedOut }),
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
