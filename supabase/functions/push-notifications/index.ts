import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";

  // GET = return VAPID public key
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ vapidPublicKey }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // POST = send push notification
  if (req.method === "POST") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const { user_id, title, message, type = "system", link } = await req.json();

      if (!user_id || !title) {
        return new Response(
          JSON.stringify({ error: "user_id and title are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert in-app notification
      const { error: insertErr } = await supabase
        .from("notifications")
        .insert({ user_id, title, message: message || "", type, link });

      if (insertErr) {
        return new Response(
          JSON.stringify({ error: insertErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send push if VAPID keys are configured
      if (vapidPublicKey && vapidPrivateKey) {
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", user_id);

        if (subs && subs.length > 0) {
          const payload = JSON.stringify({ title, body: message || "", url: link || "/" });

          // Note: Web Push protocol requires a library in production.
          // For now we log the push attempt. Full implementation requires web-push library.
          console.log(`Push would be sent to ${subs.length} subscription(s) for user ${user_id}`);
          console.log("Payload:", payload);
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: (err as Error).message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
