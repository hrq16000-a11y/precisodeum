// portability-snapshot: list snapshots, sign download URL, validate integrity,
// or delete an old snapshot. Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "list";

    if (action === "list") {
      const { data, error } = await admin
        .from("portability_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return new Response(JSON.stringify({ snapshots: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: snap, error } = await admin
        .from("portability_snapshots")
        .select("storage_path,label")
        .eq("id", id).single();
      if (error || !snap) throw error ?? new Error("not found");
      const { data: signed, error: sErr } = await admin.storage
        .from("portability")
        .createSignedUrl(snap.storage_path, 60 * 30); // 30 min
      if (sErr) throw sErr;
      return new Response(
        JSON.stringify({ url: signed.signedUrl, label: snap.label }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "validate") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: snap, error } = await admin
        .from("portability_snapshots")
        .select("*").eq("id", id).single();
      if (error || !snap) throw error ?? new Error("not found");

      const { data: file, error: dErr } = await admin.storage
        .from("portability").download(snap.storage_path);
      if (dErr || !file) throw dErr ?? new Error("download failed");

      const buf = new Uint8Array(await file.arrayBuffer());
      const hashBuf = await crypto.subtle.digest("SHA-256", buf);
      const checksum = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0")).join("");

      const ok = !snap.checksum_sha256 ||
        snap.checksum_sha256 === checksum;
      const sizeMatches = Number(snap.size_bytes) === buf.byteLength;

      await admin.from("portability_snapshots").update({
        validated_at: new Date().toISOString(),
        status: ok && sizeMatches ? "ready" : "failed",
      }).eq("id", id);

      return new Response(
        JSON.stringify({
          ok: ok && sizeMatches,
          checksum_match: ok,
          size_match: sizeMatches,
          actual_checksum: checksum,
          expected_checksum: snap.checksum_sha256,
          actual_size: buf.byteLength,
          expected_size: Number(snap.size_bytes),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "delete" && req.method === "POST") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: snap } = await admin.from("portability_snapshots")
        .select("storage_path").eq("id", id).single();
      if (snap?.storage_path) {
        await admin.storage.from("portability").remove([snap.storage_path]);
      }
      await admin.from("portability_snapshots").delete().eq("id", id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("portability-snapshot error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
