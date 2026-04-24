// Edge function: import-jobs-rss
// Captura vagas de feeds RSS cadastrados em job_import_sources e insere em jobs.
// Pode ser chamada via cron (sem body) ou manualmente passando { source_id }.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOT_UA =
  "Mozilla/5.0 (compatible; PrecisoDeUmJobsBot/1.0; +https://precisodeum.com.br)";

// ─── helpers ─────────────────────────────────────────────────────────────────

function decodeEntities(input: string): string {
  let out = input ?? "";
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
  }
  return out;
}

function stripHtml(raw: string): string {
  if (!raw) return "";
  return decodeEntities(raw)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugify(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

type FeedItem = {
  title: string;
  link: string;
  description: string;
  guid?: string;
  pubDate?: string;
};

function parseRss(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  // Suporta <item> (RSS) e <entry> (Atom)
  const blocks = xml.match(/<(item|entry)[^>]*>[\s\S]*?<\/(item|entry)>/g) ?? [];
  for (const block of blocks) {
    const pick = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? decodeEntities(m[1]).trim() : "";
    };
    const linkAtom = block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1];
    const item: FeedItem = {
      title: stripHtml(pick("title")),
      link: linkAtom ?? pick("link"),
      description: pick("description") || pick("summary") || pick("content") || pick("content:encoded"),
      guid: pick("guid") || pick("id"),
      pubDate: pick("pubDate") || pick("published") || pick("updated"),
    };
    if (item.title && item.link) items.push(item);
  }
  return items;
}

// Heurísticas leves para extrair cidade/UF do texto
const UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function extractLocation(text: string): { city: string; state: string } {
  const cityUf = text.match(/\b([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:de|do|da|dos|das|e)\s+[A-ZÀ-Ú]?[a-zà-ú]+)*)\s*[-–/]\s*([A-Z]{2})\b/);
  if (cityUf && UF_LIST.includes(cityUf[2])) {
    return { city: cityUf[1].trim(), state: cityUf[2] };
  }
  for (const uf of UF_LIST) {
    if (new RegExp(`\\b${uf}\\b`).test(text)) return { city: "", state: uf };
  }
  return { city: "", state: "" };
}

// ─── handler ────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: { source_id?: string; trigger_mode?: string } = {};
  try {
    if (req.method === "POST") payload = await req.json().catch(() => ({}));
  } catch (_) { /* ignore */ }

  const trigger_mode = payload.trigger_mode ?? "cron";

  // Buscar fontes ativas (uma específica ou todas)
  const q = supabase
    .from("job_import_sources")
    .select("*")
    .eq("is_active", true)
    .eq("source_type", "rss");
  if (payload.source_id) q.eq("id", payload.source_id);

  const { data: sources, error: srcErr } = await q;
  if (srcErr) {
    return new Response(JSON.stringify({ error: srcErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Importer user_id (para satisfazer NOT NULL em jobs.user_id) — usa o primeiro admin
  const { data: adminRow } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  const importerUserId = adminRow?.user_id;
  if (!importerUserId) {
    return new Response(JSON.stringify({ error: "no_admin_user_for_import" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const overall: any[] = [];

  for (const src of sources ?? []) {
    const log = {
      source_id: src.id,
      source_name: src.name,
      trigger_mode,
      found_count: 0,
      inserted_count: 0,
      duplicate_count: 0,
      error_count: 0,
      error_message: null as string | null,
      details: {} as Record<string, unknown>,
    };

    try {
      if (!src.feed_url) throw new Error("feed_url vazio");

      const resp = await fetch(src.feed_url, {
        headers: { "User-Agent": BOT_UA, Accept: "application/rss+xml,application/xml,text/xml,*/*" },
      });
      if (!resp.ok) throw new Error(`fetch ${resp.status}`);
      const xml = await resp.text();
      const items = parseRss(xml);
      log.found_count = items.length;

      for (const item of items) {
        const externalId = (item.guid || item.link).slice(0, 500);

        // dedup por (source, external_id)
        const { data: existing } = await supabase
          .from("jobs")
          .select("id")
          .eq("import_source_id", src.id)
          .eq("external_id", externalId)
          .maybeSingle();
        if (existing) { log.duplicate_count++; continue; }

        const cleanDesc = stripHtml(item.description).slice(0, 4000);
        const fullText = `${item.title}\n${cleanDesc}`;
        const loc = extractLocation(fullText);
        const city = loc.city || src.default_city || "";
        const state = loc.state || src.default_state || "";

        const baseSlug = slugify(item.title);
        const slug = `${baseSlug}-${externalId.slice(-8).replace(/[^a-z0-9]/gi, "")}`.toLowerCase();

        const approval_status = src.is_trusted ? "approved" : "pending";

        const { error: insErr } = await supabase.from("jobs").insert({
          user_id: importerUserId,
          title: item.title.slice(0, 200),
          description: cleanDesc || item.title,
          opportunity_type: src.default_opportunity_type || "emprego",
          city,
          state,
          neighborhood: "",
          contact_name: src.name,
          contact_phone: "",
          whatsapp: "",
          status: "active",
          approval_status,
          job_type: "",
          work_model: "",
          slug,
          subtitle: item.link,
          category_id: src.default_category_id,
          import_source_id: src.id,
          external_id: externalId,
        });

        if (insErr) {
          log.error_count++;
          log.details[`err_${log.error_count}`] = insErr.message;
        } else {
          log.inserted_count++;
        }
      }

      await supabase
        .from("job_import_sources")
        .update({ last_run_at: new Date().toISOString(), last_status: `ok: ${log.inserted_count} novas` })
        .eq("id", src.id);
    } catch (e) {
      log.error_count++;
      log.error_message = e instanceof Error ? e.message : String(e);
      await supabase
        .from("job_import_sources")
        .update({ last_run_at: new Date().toISOString(), last_status: `erro: ${log.error_message}` })
        .eq("id", src.id);
    }

    await supabase.from("job_import_log").insert(log);
    overall.push(log);
  }

  return new Response(JSON.stringify({ ok: true, sources_processed: overall.length, results: overall }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
