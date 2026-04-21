import { supabase } from '@/integrations/supabase/client';

let lastLog = 0;

/**
 * Logs a search intent (category + city) to power the FOMO demand alerts
 * shown to providers in their dashboard. Throttled to one log per 1.5s.
 */
export async function logSearchIntent(params: {
  categorySlug?: string | null;
  categoryName?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  const now = Date.now();
  if (now - lastLog < 1500) return;
  lastLog = now;
  try {
    const { data: u } = await supabase.auth.getUser();
    let visitorId: string | null = null;
    try {
      visitorId = localStorage.getItem('pdu_visitor_id');
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem('pdu_visitor_id', visitorId);
      }
    } catch {
      // ignore
    }
    await supabase.from('search_intent_log').insert({
      category_slug: params.categorySlug || null,
      category_name: params.categoryName || null,
      city: params.city || null,
      state: params.state || null,
      visitor_id: visitorId,
      user_id: u.user?.id || null,
    } as any);
  } catch {
    // best-effort, never block search
  }
}
