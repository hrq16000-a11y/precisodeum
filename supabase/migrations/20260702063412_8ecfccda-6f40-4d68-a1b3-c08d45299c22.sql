
-- =========================================================
-- 1) sponsor_leads: restrict anon UPDATE to document columns only
-- =========================================================

-- Revoke any broad UPDATE previously granted to anon at the table level
REVOKE UPDATE ON public.sponsor_leads FROM anon;

-- Grant UPDATE only on document-related columns
GRANT UPDATE (
  cnpj_document_url,
  banner_url,
  additional_docs,
  checklist_confirmed,
  docs_submitted_at
) ON public.sponsor_leads TO anon;

-- Keep authenticated/admin flows intact
GRANT UPDATE ON public.sponsor_leads TO authenticated;
GRANT ALL ON public.sponsor_leads TO service_role;

-- The existing policy "Anon attach unclaimed lead docs" already scopes rows to
-- (user_id IS NULL AND created_at > now() - 24h). Column-level GRANTs above
-- now ensure anon can ONLY modify document fields even within that window.
-- Any attempt to update email/phone/cnpj/status/etc. will fail with
-- "permission denied for column ..." at the Postgres layer.

-- =========================================================
-- 2) realtime.messages: add topic-scoped RLS policies
-- =========================================================
-- Currently no RLS policies exist on realtime.messages, meaning any
-- authenticated user could subscribe to arbitrary PRIVATE channel topics.
-- These policies enforce that authenticated users only receive/send messages
-- on topics that include their own auth.uid() (patterns "user:<uid>",
-- "...:<uid>", "<uid>:...", or ":<uid>:..." — the id must appear as a
-- delimited token, not a substring). Service role bypasses RLS as usual.
-- Public channels (default in supabase-js) are not affected by these
-- policies; postgres_changes continues to be filtered by the underlying
-- table RLS.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid = 'realtime.messages'::regclass) THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';

    -- Idempotent drops
    EXECUTE 'DROP POLICY IF EXISTS "authenticated read own topic" ON realtime.messages';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated write own topic" ON realtime.messages';

    EXECUTE $p$
      CREATE POLICY "authenticated read own topic"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() IS NOT NULL
        AND (
          realtime.topic() = ('user:' || auth.uid()::text)
          OR realtime.topic() LIKE ('%:' || auth.uid()::text)
          OR realtime.topic() LIKE (auth.uid()::text || ':%')
          OR realtime.topic() LIKE ('%:' || auth.uid()::text || ':%')
        )
      )
    $p$;

    EXECUTE $p$
      CREATE POLICY "authenticated write own topic"
      ON realtime.messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
          realtime.topic() = ('user:' || auth.uid()::text)
          OR realtime.topic() LIKE ('%:' || auth.uid()::text)
          OR realtime.topic() LIKE (auth.uid()::text || ':%')
          OR realtime.topic() LIKE ('%:' || auth.uid()::text || ':%')
        )
      )
    $p$;
  END IF;
END $$;
