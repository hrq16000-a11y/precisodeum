/**
 * Edge Function: cleanup-e2e-test-users
 *
 * Removes any auth users whose email matches the E2E signup convention
 * (`e2e+*@precisodeum.test` or explicit list) and purges related storage
 * objects. Cascades through public schema via existing FKs (profiles,
 * providers, user_roles, …) using `auth.admin.deleteUser`.
 *
 * Auth:
 *   - `x-cron-secret` header matching CRON_SECRET, OR
 *   - `Authorization: Bearer <access_token>` of a user with `admin` role.
 *
 * Body (optional JSON):
 *   { emails?: string[], pattern?: string, dryRun?: boolean }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_PATTERN = /^e2e\+.*@precisodeum\.test$/i;
const STORAGE_BUCKETS = ['avatars', 'service-images', 'portfolio', 'sponsors'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // AuthZ: cron secret OR admin JWT.
    const cronSecret = req.headers.get('x-cron-secret');
    if (!cronSecret || cronSecret !== Deno.env.get('CRON_SECRET')) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authErr } = await admin.auth.getUser(token);
      if (authErr || !user) return json({ error: 'Unauthorized' }, 401);
      const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (isAdmin !== true) return json({ error: 'Admin only' }, 403);
    }

    const body = await req.json().catch(() => ({} as any));
    const explicit: string[] = Array.isArray(body.emails) ? body.emails : [];
    const pattern = body.pattern ? new RegExp(body.pattern, 'i') : DEFAULT_PATTERN;
    const dryRun = Boolean(body.dryRun);

    // Enumerate auth users (paginated).
    const targets: { id: string; email: string }[] = [];
    let page = 1;
    const perPage = 200;
    // Cap iterations to avoid runaway loops in massive projects.
    for (let i = 0; i < 20; i++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data?.users ?? [];
      for (const u of users) {
        const email = (u.email ?? '').toLowerCase();
        if (!email) continue;
        if (explicit.includes(email) || pattern.test(email)) {
          targets.push({ id: u.id, email });
        }
      }
      if (users.length < perPage) break;
      page += 1;
    }

    if (dryRun) {
      return json({ dryRun: true, would_delete: targets.length, sample: targets.slice(0, 10) });
    }

    let deleted = 0;
    let storageDeleted = 0;
    const errors: string[] = [];

    for (const t of targets) {
      // Storage: best-effort purge of per-user folders in known buckets.
      for (const bucket of STORAGE_BUCKETS) {
        try {
          const { data: files } = await admin.storage.from(bucket).list(t.id, { limit: 1000 });
          if (files && files.length > 0) {
            const paths = files.map((f) => `${t.id}/${f.name}`);
            await admin.storage.from(bucket).remove(paths);
            storageDeleted += paths.length;
          }
        } catch { /* ignore per-bucket errors */ }
      }
      try {
        const { error: delErr } = await admin.auth.admin.deleteUser(t.id);
        if (delErr) errors.push(`${t.email}: ${delErr.message}`);
        else deleted += 1;
      } catch (e) {
        errors.push(`${t.email}: ${(e as Error).message}`);
      }
    }

    return json({
      scanned: targets.length,
      deleted,
      storage_objects_deleted: storageDeleted,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
