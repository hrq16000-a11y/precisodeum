// Edge Function: admin-impersonate
// Generates a temporary session for the target user. Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate caller
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: "Invalid token" }, 401);
    }
    const adminId = claims.claims.sub as string;

    // Parse body
    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body.target_user_id;
    const reason: string | undefined = body.reason;
    if (!targetUserId) {
      return json({ error: "target_user_id required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Server-side admin check
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: adminId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return json({ error: "Forbidden: admin only" }, 403);
    }

    // Get target user email (required to generate magiclink)
    const { data: targetUser, error: targetErr } = await admin.auth.admin.getUserById(targetUserId);
    if (targetErr || !targetUser?.user?.email) {
      return json({ error: "Target user not found or has no email" }, 404);
    }

    // Generate a magiclink (one-time-use). Frontend exchanges the hash.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.user.email,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      return json({ error: "Failed to generate impersonation link", detail: linkErr?.message }, 500);
    }

    // Log impersonation start (uses caller's JWT so RLS sees admin)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;
    const { data: sessionId, error: logErr } = await userClient.rpc("admin_log_impersonation_start", {
      _target_user_id: targetUserId,
      _reason: reason ?? null,
      _ip: ip,
      _ua: ua,
    });
    if (logErr) {
      return json({ error: "Failed to log session", detail: logErr.message }, 500);
    }

    return json({
      session_id: sessionId,
      hashed_token: linkData.properties.hashed_token,
      verify_type: "magiclink",
      target: {
        id: targetUserId,
        email: targetUser.user.email,
      },
    });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
