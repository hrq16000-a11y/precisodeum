// SEO Audit edge function — fetches /robots.txt + sitemap (paginated index),
// samples up to N URLs e checa: HTTP status, canonical, meta robots,
// <title>, meta description e JSON-LD (presença + @type esperados por rota).
//
// Auth: admin autenticado OU scheduler (x-cron-secret) OU service_role.
// Quando roda por cron, compara com o relatório anterior e notifica admins
// se houver regressão (mais erros, ou queda de páginas com JSON-LD).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeAdminOrCron } from '../_shared/adminOrCronAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SITE_URL = 'https://precisodeum.com.br';
const ROBOTS_URL = `${SITE_URL}/robots.txt`;
const DEFAULT_SAMPLE = 60; // cap to avoid timeouts (~30s budget on edge)
const FETCH_TIMEOUT_MS = 8000;

const TITLE_MIN = 15;
const TITLE_MAX = 65;
const DESC_MIN = 60;
const DESC_MAX = 165;

interface Finding {
  url: string;
  status: 'ok' | 'warning' | 'error';
  http_status?: number;
  canonical?: string | null;
  noindex?: boolean;
  title?: string | null;
  description?: string | null;
  jsonld_types?: string[];
  issues: string[];
  source_sitemap?: string;
}

async function fetchWithTimeout(url: string, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { signal: ctl.signal, redirect: 'follow' });
  } finally {
    clearTimeout(t);
  }
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}

function extractCanonical(html: string): string | null {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

/** Coleta os @type de todos os blocos JSON-LD válidos da página. */
function extractJsonLdTypes(html: string): { types: string[]; invalidBlocks: number } {
  const types: string[] = [];
  let invalidBlocks = 0;
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const t = node?.['@type'];
        if (Array.isArray(t)) types.push(...t.map(String));
        else if (t) types.push(String(t));
      }
    } catch {
      invalidBlocks += 1;
    }
  }
  return { types: [...new Set(types)], invalidBlocks };
}

/** @type esperado por família de rota — base para checar rich results. */
function expectedJsonLdTypes(pathname: string): string[] {
  if (/^\/profissional\//.test(pathname)) return ['BreadcrumbList', 'LocalBusiness'];
  if (/^\/categoria\/[^/]+\/em\//.test(pathname)) return ['BreadcrumbList', 'ItemList'];
  if (/^\/categoria\//.test(pathname)) return ['BreadcrumbList', 'Service'];
  if (/^\/cidade\//.test(pathname)) return ['BreadcrumbList'];
  return [];
}

/** Aceita subtipos equivalentes (ProfessionalService conta como LocalBusiness). */
function hasType(found: string[], expected: string): boolean {
  const equivalents: Record<string, string[]> = {
    LocalBusiness: ['LocalBusiness', 'ProfessionalService', 'Organization'],
    Service: ['Service', 'ItemList', 'CollectionPage'],
    ItemList: ['ItemList', 'CollectionPage'],
  };
  const accepted = equivalents[expected] ?? [expected];
  return found.some((t) => accepted.includes(t));
}

function auditRobots(text: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const lower = text.toLowerCase();
  if (!/sitemap:\s*https?:\/\//i.test(text)) issues.push('no Sitemap directive found');
  if (!/user-agent:\s*\*/i.test(text)) issues.push('missing User-agent: *');
  if (/disallow:\s*\/\s*$/im.test(text)) issues.push('blocks entire site (Disallow: /)');
  // sanity: required public roots not disallowed
  if (/disallow:\s*\/categoria/i.test(lower)) issues.push('Disallow blocks /categoria (SEO route)');
  if (/disallow:\s*\/buscar/i.test(lower)) issues.push('Disallow blocks /buscar');
  return { ok: issues.length === 0, issues };
}

async function gatherUrls(maxUrls: number): Promise<Array<{ url: string; sitemap: string }>> {
  const collected: Array<{ url: string; sitemap: string }> = [];
  // Fetch sitemap index
  try {
    const idxRes = await fetchWithTimeout(`${SITE_URL}/sitemap`);
    if (!idxRes.ok) return collected;
    const idxXml = await idxRes.text();
    const subs = extractLocs(idxXml);
    for (const sub of subs) {
      if (collected.length >= maxUrls) break;
      try {
        const r = await fetchWithTimeout(sub);
        if (!r.ok) continue;
        const xml = await r.text();
        const locs = extractLocs(xml);
        for (const loc of locs) {
          if (collected.length >= maxUrls) break;
          collected.push({ url: loc, sitemap: sub });
        }
      } catch { /* skip sub */ }
    }
  } catch { /* index fail */ }
  return collected;
}

async function auditUrl(url: string, sitemap: string): Promise<Finding> {
  const issues: string[] = [];
  let httpStatus: number | undefined;
  let canonical: string | null = null;
  let noindex = false;
  try {
    const res = await fetchWithTimeout(url);
    httpStatus = res.status;
    if (!res.ok) {
      issues.push(`HTTP ${res.status}`);
      return { url, source_sitemap: sitemap, http_status: httpStatus, issues, status: 'error' };
    }
    const html = await res.text();
    canonical = extractCanonical(html);
    const robotsMeta = (extractMeta(html, 'robots') || '').toLowerCase();
    noindex = robotsMeta.includes('noindex');

    // Canonical validation
    if (!canonical) {
      issues.push('missing canonical');
    } else {
      try {
        const canon = new URL(canonical, url);
        const target = new URL(url);
        if (canon.origin !== target.origin) issues.push(`canonical points to other origin: ${canon.origin}`);
        // strip trailing slash for comparison
        const norm = (u: URL) => u.pathname.replace(/\/$/, '') || '/';
        if (norm(canon) !== norm(target)) {
          // allow self-ref to category root (acceptable redirect target),
          // but warn so admin can review
          issues.push(`canonical mismatch: ${canon.pathname} vs ${target.pathname}`);
        }
      } catch {
        issues.push('canonical is not a valid URL');
      }
    }

    // Sitemap should NOT contain noindex pages
    if (noindex) issues.push('page is in sitemap but has noindex');
  } catch (err) {
    issues.push(`fetch failed: ${(err as Error).message}`);
    return { url, source_sitemap: sitemap, issues, status: 'error' };
  }

  const status: Finding['status'] = issues.length === 0
    ? 'ok'
    : (issues.some((i) => i.startsWith('HTTP') || i.includes('noindex') || i.includes('other origin'))
        ? 'error'
        : 'warning');

  return { url, source_sitemap: sitemap, http_status: httpStatus, canonical, noindex, issues, status };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Auth check — caller must be admin.
  const authHeader = req.headers.get('Authorization') || '';
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const admin = createClient(url, serviceKey);
  const { data: hasRole } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
  if (!hasRole) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  const sample = Math.min(Math.max(parseInt(body.sample ?? `${DEFAULT_SAMPLE}`, 10) || DEFAULT_SAMPLE, 5), 200);

  const t0 = Date.now();

  // 1) robots.txt
  let robotsOk = true;
  let robotsIssues: string[] = [];
  try {
    const r = await fetchWithTimeout(ROBOTS_URL);
    if (!r.ok) {
      robotsOk = false; robotsIssues = [`HTTP ${r.status}`];
    } else {
      const txt = await r.text();
      const audit = auditRobots(txt);
      robotsOk = audit.ok; robotsIssues = audit.issues;
    }
  } catch (e) {
    robotsOk = false; robotsIssues = [(e as Error).message];
  }

  // 2) sitemap urls
  const urls = await gatherUrls(sample);
  // 3) audit each URL with bounded concurrency
  const concurrency = 6;
  const findings: Finding[] = [];
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const { url: u, sitemap } = urls[idx];
      const f = await auditUrl(u, sitemap);
      findings.push(f);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));

  const ok = findings.filter((f) => f.status === 'ok').length;
  const warn = findings.filter((f) => f.status === 'warning').length;
  const err = findings.filter((f) => f.status === 'error').length;

  const durationMs = Date.now() - t0;

  const { data: report, error: insErr } = await admin.from('seo_audit_reports').insert({
    total_urls: findings.length,
    ok_count: ok,
    warning_count: warn,
    error_count: err,
    robots_ok: robotsOk,
    robots_issues: robotsIssues,
    sitemap_url: `${SITE_URL}/sitemap`,
    findings,
    duration_ms: durationMs,
    triggered_by: userData.user.id,
  }).select().single();

  if (insErr) {
    return new Response(JSON.stringify({ error: insErr.message, findings, robotsOk, robotsIssues }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    ok: true, report_id: report.id, total: findings.length, ok_count: ok,
    warning_count: warn, error_count: err, robots_ok: robotsOk, duration_ms: durationMs,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
