DROP POLICY IF EXISTS "Users can update own messages" ON public.chat_messages;
CREATE POLICY "Users can update own messages"
ON public.chat_messages FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.chat_conversations c
          WHERE c.id = chat_messages.conversation_id
            AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.chat_conversations c
          WHERE c.id = chat_messages.conversation_id
            AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role)
);