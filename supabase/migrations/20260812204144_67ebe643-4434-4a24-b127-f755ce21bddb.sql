-- JOBS: UPDATE with WITH CHECK
DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;
CREATE POLICY "Users can update own jobs"
ON public.jobs FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- SERVICES: UPDATE with WITH CHECK
DROP POLICY IF EXISTS "Provider can update own services" ON public.services;
CREATE POLICY "Provider can update own services"
ON public.services FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = services.provider_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.providers p WHERE p.id = services.provider_id AND p.user_id = auth.uid()));

-- CHAT CONVERSATIONS: no arbitrary participants
DROP POLICY IF EXISTS "Users can insert conversations" ON public.chat_conversations;
CREATE POLICY "Users can insert conversations"
ON public.chat_conversations FOR INSERT TO authenticated
WITH CHECK (
  participant_a IS NOT NULL
  AND participant_b IS NOT NULL
  AND participant_a <> participant_b
  AND (auth.uid() = participant_a OR auth.uid() = participant_b)
  AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = participant_a)
  AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = participant_b)
);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.chat_conversations;
CREATE POLICY "Users can update own conversations"
ON public.chat_conversations FOR UPDATE TO authenticated
USING (auth.uid() = participant_a OR auth.uid() = participant_b OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = participant_a OR auth.uid() = participant_b OR has_role(auth.uid(), 'admin'::app_role));

-- Block participant swapping on update
CREATE OR REPLACE FUNCTION public.guard_chat_conversation_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.participant_a IS DISTINCT FROM OLD.participant_a
     OR NEW.participant_b IS DISTINCT FROM OLD.participant_b THEN
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
      NEW.participant_a := OLD.participant_a;
      NEW.participant_b := OLD.participant_b;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_chat_conversation_participants ON public.chat_conversations;
CREATE TRIGGER trg_guard_chat_conversation_participants
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.guard_chat_conversation_participants();

-- remove duplicate insert policy on chat_messages
DROP POLICY IF EXISTS "Users or admins can insert messages" ON public.chat_messages;