// Edge function: captura IP, ISP, navegador e localização aproximada via ip-api.com
// Chamada após signup ou login para auditoria jurídica.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function parseUA(ua: string) {
  const lower = ua.toLowerCase();
  let os = "Unknown";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")) os = "iOS";
  else if (lower.includes("mac")) os = "macOS";
  else if (lower.includes("linux")) os = "Linux";

  let browser = "Unknown";
  if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("chrome/") && !lower.includes("edg/")) browser = "Chrome";
  else if (lower.includes("firefox/")) browser = "Firefox";
  else if (lower.includes("safari/") && !lower.includes("chrome/")) browser = "Safari";

  const device = /mobile|android|iphone/i.test(ua) ? "mobile" : /tablet|ipad/i.test(ua) ? "tablet" : "desktop";
  return { os, browser, device };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identifica o usuário a partir do JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    const userId = userData?.user?.id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const eventType: string = body.event_type || "login";

    // IP do cliente (cf-connecting-ip ou x-forwarded-for)
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "";

    // User-agent
    const ua = req.headers.get("user-agent") || "";
    const { os, browser, device } = parseUA(ua);

    // Geolocalização aproximada via ip-api.com (gratuito, sem chave, 45 req/min por IP)
    let geo: any = {};
    if (ip && !ip.startsWith("127.") && !ip.startsWith("10.") && ip !== "::1") {
      try {
        const r = await fetch(
          `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,isp,org,query`,
        );
        if (r.ok) {
          const j = await r.json();
          if (j.status === "success") geo = j;
        }
      } catch (_) {
        // silencioso, não bloqueia o login
      }
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { error } = await admin.from("user_access_logs").insert({
      user_id: userId,
      event_type: eventType,
      ip_address: ip || null,
      isp: geo.isp || geo.org || null,
      country: geo.country || null,
      region: geo.regionName || null,
      city: geo.city || null,
      user_agent: ua,
      device_type: device,
      os,
      browser,
      metadata: { source: body.source || "web" },
    });

    if (error) {
      console.error("insert error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, geo: { city: geo.city, region: geo.regionName, country: geo.country } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
