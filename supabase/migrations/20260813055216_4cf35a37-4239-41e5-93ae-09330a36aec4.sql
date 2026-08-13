
CREATE TABLE IF NOT EXISTS public.gsc_job_locks (
  lock_key text PRIMARY KEY,
  holder text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT ALL ON public.gsc_job_locks TO service_role;
GRANT SELECT ON public.gsc_job_locks TO authenticated;

ALTER TABLE public.gsc_job_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gsc_job_locks_admin_read" ON public.gsc_job_locks;
CREATE POLICY "gsc_job_locks_admin_read"
ON public.gsc_job_locks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.gsc_try_acquire_lock(
  _lock_key text,
  _holder text,
  _ttl_seconds integer DEFAULT 900,
  _meta jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (acquired boolean, holder text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.gsc_job_locks%ROWTYPE;
BEGIN
  INSERT INTO public.gsc_job_locks AS l (lock_key, holder, acquired_at, expires_at, meta)
  VALUES (_lock_key, _holder, now(), now() + make_interval(secs => GREATEST(_ttl_seconds, 30)), COALESCE(_meta, '{}'::jsonb))
  ON CONFLICT (lock_key) DO UPDATE
    SET holder = EXCLUDED.holder,
        acquired_at = now(),
        expires_at = EXCLUDED.expires_at,
        meta = EXCLUDED.meta
    WHERE l.expires_at < now()
  RETURNING * INTO v_row;

  IF v_row.lock_key IS NOT NULL THEN
    RETURN QUERY SELECT true, v_row.holder, v_row.expires_at;
  ELSE
    SELECT * INTO v_row FROM public.gsc_job_locks WHERE lock_key = _lock_key;
    RETURN QUERY SELECT false, v_row.holder, v_row.expires_at;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsc_release_lock(_lock_key text, _holder text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (
    DELETE FROM public.gsc_job_locks
    WHERE lock_key = _lock_key AND holder = _holder
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM d);
$$;

REVOKE ALL ON FUNCTION public.gsc_try_acquire_lock(text, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsc_release_lock(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsc_try_acquire_lock(text, text, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsc_release_lock(text, text) TO service_role;
