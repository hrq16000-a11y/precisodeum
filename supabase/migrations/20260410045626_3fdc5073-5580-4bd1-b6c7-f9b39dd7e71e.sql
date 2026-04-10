
-- Chat settings (admin-manageable)
CREATE TABLE public.chat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  allowed_profile_types jsonb NOT NULL DEFAULT '["provider","rh"]'::jsonb,
  min_services integer NOT NULL DEFAULT 3,
  min_portfolio_albums integer NOT NULL DEFAULT 1,
  blocked_message text NOT NULL DEFAULT 'Você precisa ter pelo menos 3 serviços e 1 portfólio para usar o chat.',
  welcome_message text NOT NULL DEFAULT 'Bem-vindo ao chat! Conecte-se com outros profissionais.',
  max_message_length integer NOT NULL DEFAULT 1000,
  allow_images boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat settings viewable by everyone" ON public.chat_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update chat settings" ON public.chat_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert chat settings" ON public.chat_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete chat settings" ON public.chat_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.chat_settings (enabled, allowed_profile_types, min_services, min_portfolio_albums) VALUES (true, '["provider","rh"]', 3, 1);

-- Chat conversations
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a uuid NOT NULL,
  participant_b uuid NOT NULL,
  last_message_text text DEFAULT '',
  last_message_at timestamptz DEFAULT now(),
  unread_count_a integer NOT NULL DEFAULT 0,
  unread_count_b integer NOT NULL DEFAULT 0,
  blocked boolean NOT NULL DEFAULT false,
  blocked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_conversation UNIQUE (participant_a, participant_b)
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.chat_conversations FOR SELECT TO authenticated
  USING (auth.uid() = participant_a OR auth.uid() = participant_b OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert conversations" ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = participant_a OR auth.uid() = participant_b);

CREATE POLICY "Users can update own conversations" ON public.chat_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = participant_a OR auth.uid() = participant_b OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete conversations" ON public.chat_conversations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Chat messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  image_url text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations" ON public.chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can insert messages in own conversations" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
      AND c.blocked = false
    )
  );

CREATE POLICY "Users can update own messages" ON public.chat_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete messages" ON public.chat_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for performance
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_conversations_participants ON public.chat_conversations(participant_a, participant_b);

-- Trigger to update conversation last message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE chat_conversations SET
    last_message_text = LEFT(NEW.content, 100),
    last_message_at = NEW.created_at,
    updated_at = now(),
    unread_count_a = CASE WHEN participant_a = NEW.sender_id THEN unread_count_a ELSE unread_count_a + 1 END,
    unread_count_b = CASE WHEN participant_b = NEW.sender_id THEN unread_count_b ELSE unread_count_b + 1 END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_last_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
