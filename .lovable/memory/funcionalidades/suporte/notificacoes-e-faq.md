---
name: Notificações in-app de tickets de suporte
description: Triggers Postgres em support_ticket_messages e support_tickets que criam notifications in-app para admin (nova msg user) e usuário (resposta admin, status change closed/reopen, block toggle). Sem e-mail.
type: feature
---

## Triggers
- `trg_notify_admins_on_support_user_message` (AFTER INSERT support_ticket_messages WHERE sender_role='user') → cria notification type=`support_new_message` para cada admin (loop em user_roles), link `/admin/chat?ticket=<id>`.
- `trg_notify_user_on_support_admin_reply` (AFTER INSERT support_ticket_messages WHERE sender_role='admin') → notification type=`support_admin_reply` para o dono do ticket, link `/dashboard/suporte`.
- `trg_notify_user_on_support_status_change` (AFTER UPDATE support_tickets) → notification type=`support_status` quando OLD.blocked≠NEW.blocked OU OLD.status≠NEW.status (somente fechamento/reabertura; transições open_user↔open_admin não notificam pois mensagens já notificam).

## Não envia e-mail
Por decisão do produto, esta fase é só in-app. Para ativar e-mail depois: criar edge function que escuta as mesmas notifications e dispara via Lovable Emails (ou flag `support_emails_enabled`).

## CTA na Central de Ajuda
`/ajuda` substituiu o link de WhatsApp por `<OpenSupportTicketCard />` (src/components/support/OpenSupportTicketCard.tsx) com assunto + descrição. Cria/reutiliza ticket ativo do user e insere a 1ª mensagem; redireciona para `/dashboard/suporte`. Não autenticado → CTA para `/login?next=/dashboard/suporte`.

## Testes
- `src/test/support-rls-by-role.test.ts` (8): user comum filtra user_id; admin não filtra; sender_role correto; OR de busca cobre 4 colunas.
- Total: 22 testes passando entre `support-ticket-rules` (8), `support-ticket-queries` (6) e `support-rls-by-role` (8).
