-- Consolidate INSERT policies on chat_messages into one canonical rule
DROP POLICY IF EXISTS "Participants or admins can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.chat_messages;

CREATE POLICY "chat_messages_insert_participants_or_admin"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
        AND c.blocked = false
    )
  )
);