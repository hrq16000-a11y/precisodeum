-- Trigger 1: notifica admins quando user envia mensagem
CREATE OR REPLACE FUNCTION public.notify_admins_on_support_user_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name text;
  v_admin_id uuid;
  v_link text;
BEGIN
  IF NEW.sender_role <> 'user' THEN
    RETURN NEW;
  END IF;

  SELECT user_full_name INTO v_user_name FROM public.support_tickets WHERE id = NEW.ticket_id;
  v_link := '/admin/chat?ticket=' || NEW.ticket_id::text;

  FOR v_admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_admin_id,
      'support_new_message',
      'Nova mensagem de suporte',
      COALESCE(v_user_name, 'Usuário') || ': ' || left(NEW.content, 120),
      v_link,
      jsonb_build_object('ticket_id', NEW.ticket_id, 'message_id', NEW.id)
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_support_user_message ON public.support_ticket_messages;
CREATE TRIGGER trg_notify_admins_on_support_user_message
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_support_user_message();

-- Trigger 2: notifica usuário quando admin responde
CREATE OR REPLACE FUNCTION public.notify_user_on_support_admin_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NEW.sender_role <> 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_user_id FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (
    v_user_id,
    'support_admin_reply',
    'Resposta do suporte',
    left(NEW.content, 160),
    '/dashboard/suporte',
    jsonb_build_object('ticket_id', NEW.ticket_id, 'message_id', NEW.id)
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_user_on_support_admin_reply ON public.support_ticket_messages;
CREATE TRIGGER trg_notify_user_on_support_admin_reply
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_user_on_support_admin_reply();

-- Trigger 3: notifica usuário quando status muda (closed/reopen/blocked)
CREATE OR REPLACE FUNCTION public.notify_user_on_support_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_msg text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Bloqueio/desbloqueio
  IF (TG_OP = 'UPDATE') AND (OLD.blocked IS DISTINCT FROM NEW.blocked) THEN
    IF NEW.blocked THEN
      v_title := 'Ticket bloqueado pelo suporte';
      v_msg := 'Seu ticket foi bloqueado por um administrador.';
    ELSE
      v_title := 'Ticket desbloqueado';
      v_msg := 'Seu ticket foi desbloqueado e você pode voltar a enviar mensagens.';
    END IF;
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (NEW.user_id, 'support_status', v_title, v_msg, '/dashboard/suporte',
            jsonb_build_object('ticket_id', NEW.id, 'event', 'block_change', 'blocked', NEW.blocked))
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mudança de status (open_user/open_admin/closed) — só notifica fechamento/reabertura
  IF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'closed' THEN
      v_title := 'Ticket encerrado';
      v_msg := 'Seu ticket de suporte foi marcado como concluído.';
    ELSIF OLD.status = 'closed' AND NEW.status <> 'closed' THEN
      v_title := 'Ticket reaberto';
      v_msg := 'Seu ticket de suporte foi reaberto.';
    ELSE
      RETURN NEW; -- transições open_user<->open_admin não geram notificação direta (mensagens já notificam)
    END IF;
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (NEW.user_id, 'support_status', v_title, v_msg, '/dashboard/suporte',
            jsonb_build_object('ticket_id', NEW.id, 'event', 'status_change', 'status', NEW.status))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_user_on_support_status_change ON public.support_tickets;
CREATE TRIGGER trg_notify_user_on_support_status_change
AFTER UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_user_on_support_status_change();