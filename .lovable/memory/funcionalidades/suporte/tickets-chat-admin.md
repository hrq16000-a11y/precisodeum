---
name: Tickets de Suporte (chat usuário ↔ admin)
description: Sistema de tickets isolado em support_tickets/support_ticket_messages, regra de 3 mensagens consecutivas, painel admin com paginação 20/busca por nome/cidade/assunto/status, P2P desativado via flag chat_p2p_enabled.
type: feature
---

## Modelo
Tabelas isoladas do P2P: `support_tickets` (status open_user/open_admin/closed, consecutive_user_msgs, user_city/full_name cacheados via trigger hydrate_support_ticket_user) e `support_ticket_messages` (sender_role user|admin).

## Regra das 3 mensagens
Trigger `support_message_after_insert` incrementa `consecutive_user_msgs` em msg do user; ao chegar em 3 muda status para `open_admin` (RLS bloqueia novo INSERT do user). Quando admin responde, contador zera e status volta a `open_user`. Helper `canUserSend` em `src/hooks/useSupportTicket.ts`.

## RLS
- SELECT tickets/msgs: dono OU admin
- INSERT user msg: só sender_id=auth.uid() + ticket próprio + status=open_user + !blocked
- INSERT admin msg: requer has_role(admin) + sender_role='admin'
- DELETE: só admin

## UI
- Usuário: `/dashboard/suporte` (DashboardSupportPage) — abre/usa ticket único ativo, mostra "X de 3 restantes", banner "Aguardando admin" quando open_admin.
- Admin: aba "Tickets de Suporte" no `/admin/chat` (componente `AdminSupportTicketsPanel`) — paginação 20/página, busca OR ilike em user_full_name/user_city/subject/last_message_text, filtro por status (open_user/open_admin/closed/blocked), ações fechar/reabrir/bloquear/excluir mensagem.

## Flag P2P
`site_settings.chat_p2p_enabled = false` desativa o chat P2P; `DashboardChatPage` redireciona para `/dashboard/suporte` via `useFeatureEnabled('chat_p2p_enabled')`.

## Testes
- `src/test/support-ticket-rules.test.ts` (8): canUserSend/userRemainingMessages
- `src/test/support-ticket-queries.test.ts` (6): contrato de queries por papel (user filtra user_id, admin não; sender_role correto; OR de busca; range 20)
