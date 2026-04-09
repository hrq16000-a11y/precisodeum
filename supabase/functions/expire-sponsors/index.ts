import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();

    // Find active sponsors whose end_date has passed
    const { data: expired, error: fetchErr } = await supabase
      .from("sponsors")
      .select("id, title, end_date")
      .eq("active", true)
      .not("end_date", "is", null)
      .lt("end_date", now);

    if (fetchErr) throw fetchErr;

    if (!expired || expired.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum patrocinador expirado", deactivated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ids = expired.map((s) => s.id);

    // Deactivate expired sponsors
    const { error: updateErr } = await supabase
      .from("sponsors")
      .update({ active: false, status: "expired" })
      .in("id", ids);

    if (updateErr) throw updateErr;

    // Log to audit
    const auditRows = expired.map((s) => ({
      user_id: "00000000-0000-0000-0000-000000000000",
      action: "auto_expire",
      resource_type: "sponsor",
      resource_id: s.id,
      details: { title: s.title, end_date: s.end_date, reason: "cron_expiration" },
    }));

    await supabase.from("audit_log").insert(auditRows);

    // Notify admins via sponsor_notifications
    const notifRows = expired.map((s) => ({
      sponsor_id: s.id,
      title: "Patrocínio expirado",
      message: `O patrocínio "${s.title}" foi desativado automaticamente (expirou em ${new Date(s.end_date!).toLocaleDateString("pt-BR")}).`,
      type: "expiration",
    }));

    await supabase.from("sponsor_notifications").insert(notifRows);

    // Flag PRO sponsors with under-delivery for compensation
    const { error: compErr } = await supabase
      .from("sponsors")
      .update({ needs_compensation: true })
      .eq("plan", "pro")
      .eq("needs_compensation", false)
      .lt("campaign_end", now)
      .not("guaranteed_impressions", "is", null);

    // The above targets all expired PRO sponsors; we refine by checking
    // delivered < guaranteed via a raw filter isn't possible with PostgREST,
    // so we do a secondary check
    if (!compErr) {
      const { data: proCandidates } = await supabase
        .from("sponsors")
        .select("id, delivered_impressions, guaranteed_impressions")
        .eq("plan", "pro")
        .eq("needs_compensation", true)
        .not("guaranteed_impressions", "is", null);

      if (proCandidates) {
        const falsePositives = proCandidates
          .filter((s) => (s.delivered_impressions ?? 0) >= (s.guaranteed_impressions ?? 0))
          .map((s) => s.id);

        if (falsePositives.length > 0) {
          await supabase
            .from("sponsors")
            .update({ needs_compensation: false })
            .in("id", falsePositives);
        }
      }
    }

    console.log(`Deactivated ${ids.length} expired sponsors:`, expired.map((s) => s.title));

    return new Response(
      JSON.stringify({
        message: `${ids.length} patrocinador(es) desativado(s)`,
        deactivated: ids.length,
        sponsors: expired.map((s) => ({ id: s.id, title: s.title, end_date: s.end_date })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("expire-sponsors error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
