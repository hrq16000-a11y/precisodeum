
-- Phase 2.4: Sponsor self-service change requests
CREATE TABLE IF NOT EXISTS public.sponsor_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  storage_paths text[] NOT NULL DEFAULT '{}'::text[],
  admin_comment text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_change_requests_sponsor ON public.sponsor_change_requests(sponsor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sponsor_change_requests_status ON public.sponsor_change_requests(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sponsor_pending_request
  ON public.sponsor_change_requests(sponsor_id)
  WHERE status = 'pending';

ALTER TABLE public.sponsor_change_requests ENABLE ROW LEVEL SECURITY;

-- Sponsor reads own requests
CREATE POLICY "Sponsor reads own change requests"
ON public.sponsor_change_requests
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sponsor_contacts sc
    WHERE sc.sponsor_id = sponsor_change_requests.sponsor_id
      AND sc.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Inserts/updates happen via RPC only (no direct policy)
CREATE POLICY "Admin can update change requests"
ON public.sponsor_change_requests
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_sponsor_change_request_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sponsor_change_request_updated_at ON public.sponsor_change_requests;
CREATE TRIGGER trg_sponsor_change_request_updated_at
BEFORE UPDATE ON public.sponsor_change_requests
FOR EACH ROW EXECUTE FUNCTION public.set_sponsor_change_request_updated_at();

-- Whitelist of editable fields (server-side guard)
-- Allowed keys: image_url, logo_url, link_url, external_link, phone, whatsapp,
--               short_description, full_description, linked_city, linked_category,
--               renewal_requested (meta only, not applied to sponsors)

CREATE OR REPLACE FUNCTION public.sponsor_submit_change_request(
  _sponsor_id uuid,
  _changes jsonb,
  _storage_paths text[] DEFAULT '{}'::text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed text[] := ARRAY[
    'image_url','logo_url','link_url','external_link',
    'phone','whatsapp','short_description','full_description',
    'linked_city','linked_category','renewal_requested'
  ];
  v_key text;
  v_snapshot jsonb;
  v_recent_count int;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- Ownership check
  IF NOT EXISTS (
    SELECT 1 FROM public.sponsor_contacts
    WHERE sponsor_id = _sponsor_id AND user_id = v_uid
  ) AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'not authorized for this sponsor' USING ERRCODE = '42501';
  END IF;

  -- Whitelist enforcement
  FOR v_key IN SELECT jsonb_object_keys(_changes) LOOP
    IF NOT (v_key = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'field % is not editable via self-service', v_key USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF jsonb_typeof(_changes) <> 'object' OR _changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'no changes provided' USING ERRCODE = '22023';
  END IF;

  -- Rate limit: max 5 requests in 24h
  SELECT count(*) INTO v_recent_count
  FROM public.sponsor_change_requests
  WHERE sponsor_id = _sponsor_id
    AND created_at > now() - interval '24 hours';
  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'rate limit: max 5 change requests per 24h' USING ERRCODE = '53400';
  END IF;

  -- Single pending lock (also enforced by unique index — friendlier error)
  IF EXISTS (
    SELECT 1 FROM public.sponsor_change_requests
    WHERE sponsor_id = _sponsor_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'there is already a pending change request' USING ERRCODE = '23505';
  END IF;

  -- Snapshot current values for the keys being changed
  SELECT jsonb_build_object(
    'image_url', image_url,
    'logo_url', logo_url,
    'link_url', link_url,
    'external_link', external_link,
    'phone', phone,
    'whatsapp', whatsapp,
    'short_description', short_description,
    'full_description', full_description,
    'linked_city', linked_city,
    'linked_category', linked_category
  ) INTO v_snapshot
  FROM public.sponsors WHERE id = _sponsor_id;

  INSERT INTO public.sponsor_change_requests(sponsor_id, requested_by, changes, current_snapshot, storage_paths)
  VALUES (_sponsor_id, v_uid, _changes, COALESCE(v_snapshot, '{}'::jsonb), COALESCE(_storage_paths, '{}'::text[]))
  RETURNING id INTO v_id;

  -- Audit
  INSERT INTO public.audit_log(action, resource_type, resource_id, user_id, details)
  VALUES ('sponsor_change_request_submitted', 'sponsor_change_request', v_id, v_uid,
          jsonb_build_object('sponsor_id', _sponsor_id, 'fields', (SELECT array_agg(k) FROM jsonb_object_keys(_changes) k)));

  -- Notify admins
  INSERT INTO public.notifications(user_id, type, title, message, link)
  SELECT ur.user_id, 'sponsor_change_request', 'Nova solicitação de patrocinador',
         'Há uma alteração aguardando revisão.', '/admin/sponsor-change-requests'
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sponsor_cancel_change_request(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.sponsor_change_requests;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required' USING ERRCODE='28000'; END IF;

  SELECT * INTO v_row FROM public.sponsor_change_requests WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;

  IF v_row.requested_by <> v_uid AND NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'only pending requests can be cancelled' USING ERRCODE='22023';
  END IF;

  UPDATE public.sponsor_change_requests
  SET status='cancelled', reviewed_by=v_uid, reviewed_at=now()
  WHERE id=_id;

  INSERT INTO public.audit_log(action, resource_type, resource_id, user_id, details)
  VALUES ('sponsor_change_request_cancelled', 'sponsor_change_request', _id, v_uid,
          jsonb_build_object('sponsor_id', v_row.sponsor_id, 'storage_paths', v_row.storage_paths));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_sponsor_change_request(
  _id uuid,
  _decision text,
  _comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.sponsor_change_requests;
  v_allowed text[] := ARRAY[
    'image_url','logo_url','link_url','external_link',
    'phone','whatsapp','short_description','full_description',
    'linked_city','linked_category'
  ];
  v_key text;
  v_sql text;
  v_set_clauses text[] := ARRAY[]::text[];
  v_contact_user uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid,'admin') THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE='42501';
  END IF;

  IF _decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid decision' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_row FROM public.sponsor_change_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'only pending requests can be reviewed' USING ERRCODE='22023';
  END IF;

  IF _decision = 'approved' THEN
    FOR v_key IN SELECT jsonb_object_keys(v_row.changes) LOOP
      IF v_key = ANY(v_allowed) THEN
        v_set_clauses := array_append(v_set_clauses, format('%I = %L', v_key, v_row.changes->>v_key));
      END IF;
    END LOOP;

    IF array_length(v_set_clauses, 1) > 0 THEN
      v_sql := format('UPDATE public.sponsors SET %s WHERE id = %L',
                      array_to_string(v_set_clauses, ', '), v_row.sponsor_id);
      EXECUTE v_sql;
    END IF;
  END IF;

  UPDATE public.sponsor_change_requests
  SET status = _decision,
      admin_comment = _comment,
      reviewed_by = v_uid,
      reviewed_at = now()
  WHERE id = _id;

  -- Audit
  INSERT INTO public.audit_log(action, resource_type, resource_id, user_id, details)
  VALUES (
    'sponsor_change_request_' || _decision,
    'sponsor_change_request', _id, v_uid,
    jsonb_build_object(
      'sponsor_id', v_row.sponsor_id,
      'comment', _comment,
      'changes', v_row.changes,
      'snapshot', v_row.current_snapshot
    )
  );

  -- Notify sponsor contact(s)
  FOR v_contact_user IN
    SELECT user_id FROM public.sponsor_contacts WHERE sponsor_id = v_row.sponsor_id
  LOOP
    INSERT INTO public.notifications(user_id, type, title, message, link)
    VALUES (
      v_contact_user, 'sponsor_change_request',
      CASE WHEN _decision='approved' THEN 'Alteração aprovada' ELSE 'Alteração rejeitada' END,
      COALESCE(_comment, CASE WHEN _decision='approved' THEN 'Suas alterações foram aplicadas.' ELSE 'Suas alterações foram rejeitadas.' END),
      '/sponsor-panel/editar'
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sponsor_submit_change_request(uuid, jsonb, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sponsor_cancel_change_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_sponsor_change_request(uuid, text, text) TO authenticated;
