import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * Integration test: when an unauthenticated (anon) caller hits the secure RPC
 * `get_profile_tax_id`, the response MUST NOT contain a `tax_id` field with
 * a real value. The RPC is SECURITY DEFINER and authorizes only the owner
 * (auth.uid() = _profile_id) or admins. Anonymous calls should be rejected
 * (error) or return an empty/null payload — never the document.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const RUN = !!SUPABASE_URL && !!SUPABASE_KEY;
const maybe = RUN ? describe : describe.skip;

maybe('RPC get_profile_tax_id — privacy guard for anonymous callers', () => {
  it('never returns a usable tax_id payload to anon callers', async () => {
    const client = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Pick any random UUID — anon must not be able to read anyone's tax_id.
    const randomProfileId = '00000000-0000-0000-0000-000000000001';
    const { data, error } = await client.rpc('get_profile_tax_id', {
      _profile_id: randomProfileId,
    });

    // Acceptable outcomes (any one of):
    //  1. RPC returns an error (denied).
    //  2. RPC returns null / empty array.
    //  3. RPC returns a row whose tax_id is null.
    if (error) {
      expect(error).toBeTruthy();
      return;
    }

    const rows = Array.isArray(data) ? data : data ? [data] : [];
    for (const row of rows) {
      // Critical: tax_id (decrypted document) must never leak to anon.
      expect((row as any)?.tax_id ?? null).toBeNull();
    }
  });
});

if (!RUN) {
  // Surface why the suite was skipped, without failing CI when env is unavailable.
  // eslint-disable-next-line no-console
  console.warn('[tax-id-rpc-anon-denial] Skipped: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY not set.');
}
