-- Feature flag para desativar P2P
INSERT INTO public.site_settings (key, value, description)
VALUES ('chat_p2p_enabled', 'false'::jsonb, 'Ativa/desativa o chat P2P (prestador↔cliente). Desativado em favor do suporte.')
ON CONFLICT (key) DO NOTHING;

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.support_ticket_status AS ENUM ('open_user', 'open_admin', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_message_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL DEFAULT 'Suporte',
  status public.support_ticket_status NOT NULL DEFAULT 'open_user',
  consecutive_user_msgs int NOT NULL DEFAULT 0,
  user_city text,
  user_full_name text,
  last_message_text text,
  last_message_at timestamptz,
  unread_admin int NOT NULL DEFAULT 0,
  unread_user int NOT NULL DEFAULT 0,
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_lastmsg ON public.support_tickets(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_support_tickets_city ON public.support_tickets(user_city);

-- Mensagens
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role public.support_message_role NOT NULL,
  content text NOT NULL CHECK (length(content) > 0 AND length(content) <= 4000),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_msgs_ticket ON public.support_ticket_messages(ticket_id, created_at);

-- Hidratar user_city/full_name no insert de ticket
CREATE OR REPLACE FUNCTION public.hydrate_support_ticket_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT p.full_name, COALESCE(pr.city, '')
    INTO NEW.user_full_name, NEW.user_city
  FROM public.profiles p
  LEFT JOIN public.providers pr ON pr.user_id = p.id AND pr.deleted_at IS NULL
  WHERE p.id = NEW.user_id
  LIMIT 1;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_hydrate_support_ticket_user ON public.support_tickets;
CREATE TRIGGER trg_hydrate_support_ticket_user
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.hydrate_support_ticket_user();

-- Regra: ao inserir mensagem, atualizar ticket e contador de 3
CREATE OR REPLACE FUNCTION public.support_message_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status public.support_ticket_status;
  v_count int;
BEGIN
  SELECT status, consecutive_user_msgs INTO v_status, v_count
  FROM public.support_tickets WHERE id = NEW.ticket_id FOR UPDATE;

  IF NEW.sender_role = 'user' THEN
    v_count := v_count + 1;
    UPDATE public.support_tickets
       SET consecutive_user_msgs = v_count,
           status = CASE WHEN v_count >= 3 THEN 'open_admin'::public.support_ticket_status ELSE status END,
           last_message_text = left(NEW.content, 200),
           last_message_at = NEW.created_at,
           unread_admin = unread_admin + 1,
           updated_at = now()
     WHERE id = NEW.ticket_id;
  ELSE
    -- admin respondeu: zera contador e volta para open_user
    UPDATE public.support_tickets
       SET consecutive_user_msgs = 0,
           status = CASE WHEN status = 'closed' THEN 'closed' ELSE 'open_user'::public.support_ticket_status END,
           last_message_text = left(NEW.content, 200),
           last_message_at = NEW.created_at,
           unread_user = unread_user + 1,
           updated_at = now()
     WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_support_message_after_insert ON public.support_ticket_messages;
CREATE TRIGGER trg_support_message_after_insert
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_message_after_insert();

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Tickets: dono OU admin lê
CREATE POLICY "support_tickets_select_owner_or_admin"
ON public.support_tickets FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "support_tickets_insert_owner"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "support_tickets_update_admin_or_owner_limited"
ON public.support_tickets FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "support_tickets_delete_admin"
ON public.support_tickets FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Mensagens: leitura para dono do ticket ou admin
CREATE POLICY "support_msgs_select_owner_or_admin"
ON public.support_ticket_messages FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.support_tickets t
             WHERE t.id = support_ticket_messages.ticket_id AND t.user_id = auth.uid())
);

-- Insert: usuário só posta no próprio ticket E status = open_user E não bloqueado
-- Admin posta como admin em qualquer ticket
CREATE POLICY "support_msgs_insert_user"
ON public.support_ticket_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    (sender_role = 'admin' AND public.has_role(auth.uid(), 'admin'))
    OR (
      sender_role = 'user'
      AND EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = support_ticket_messages.ticket_id
          AND t.user_id = auth.uid()
          AND t.status = 'open_user'
          AND t.blocked = false
      )
    )
  )
);

CREATE POLICY "support_msgs_delete_admin"
ON public.support_ticket_messages FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));