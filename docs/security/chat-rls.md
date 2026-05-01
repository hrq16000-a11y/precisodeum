# RLS do Chat — `chat_messages` e `chat_conversations`

> Última revisão: 2026-05-01. Estado **auditado e validado** em produção. Nenhum bypass via service-role no client.

## Resumo executivo

O chat é **par a par** (Pro/HR ↔ Pro/HR), com admin podendo **moderar** mas nunca se passar por outro usuário. Toda escrita exige `sender_id = auth.uid()` para rastreabilidade.

## `chat_conversations`

| Operação | Quem pode | Condição |
|---|---|---|
| **SELECT** | participantes **ou** admin | `auth.uid() IN (participant_a, participant_b)` OR `has_role(auth.uid(), 'admin')` |
| **INSERT** | criador participa | `auth.uid() IN (participant_a, participant_b)` |
| **UPDATE** | participantes **ou** admin | mesma condição do SELECT |
| **DELETE** | só admin | `has_role(auth.uid(), 'admin')` |

**Por quê:** uma conversa é estritamente privada entre duas pessoas. Admin enxerga e atualiza (ex: marcar `blocked=true`) para moderar; só admin pode apagar conversa inteira.

## `chat_messages`

| Operação | Policy | Condição |
|---|---|---|
| **SELECT** | `Users can view messages in own conversations` | participante da conversa **ou** admin |
| **INSERT** | `chat_messages_insert_participants_or_admin` | `sender_id = auth.uid()` **AND** (admin **OR** participante de conversa **não bloqueada**) |
| **UPDATE** | `Users can update own messages` | participante **ou** admin |
| **DELETE** | `Admins can delete messages` | só admin |

### Garantias do INSERT

1. **Identidade**: `auth.uid() = sender_id` em **todos** os casos. Admin posta como ele mesmo, nunca se passa por outro usuário (mantém auditoria).
2. **Bloqueio respeitado**: usuários comuns não podem enviar em conversas com `blocked = true`. Admin contorna o bloqueio para enviar avisos oficiais.
3. **Apenas autenticados**: `TO authenticated` em todas as policies.

### Por que **não** usamos service-role no backend

A pergunta surgiu durante a auditoria. A decisão é **manter a postagem do admin via RLS normal** porque:

- Admin já consegue inserir como ele mesmo via RLS — sem necessidade de `service_role`.
- Postar com service-role permitindo `sender_id ≠ auth.uid()` quebraria a rastreabilidade.
- Edge function com service-role abre superfície de ataque desnecessária para uma operação que o RLS resolve.

Se algum dia precisarmos de "aviso oficial do sistema" (mensagem automática), criamos um `system_user_id` dedicado e fazemos o admin postar **a partir desse user**, mantendo `sender_id = auth.uid()` literalmente verdadeiro.

## Painel de moderação — `/admin/chat`

Rota: `src/pages/AdminChatPage.tsx`. Funcionalidades:

- **Configurações**: tipos de perfil habilitados, mensagem de bloqueio, tamanho máximo, anexos.
- **Conversas**: lista de todas as conversas (admin enxerga via SELECT policy), com:
  - Toggle **Bloquear/Desbloquear** (UPDATE policy)
  - **Excluir conversa** completa (DELETE policy)
  - **Viewer de mensagens** com botão **Excluir mensagem** individual (DELETE policy em `chat_messages`)

Tudo passa por RLS — nenhuma chamada usa service-role no client.

## Como auditar manualmente

```sql
-- 1) Confirmar RLS habilitada e nº de policies
SELECT relrowsecurity FROM pg_class WHERE oid='public.chat_messages'::regclass;
SELECT polname, polcmd FROM pg_policy WHERE polrelid='public.chat_messages'::regclass;

-- 2) Listar conversas bloqueadas
SELECT id, participant_a, participant_b, blocked, last_message_text
FROM public.chat_conversations WHERE blocked = true;
```

## Histórico de migrations

- **2026-05-01** — Consolidação das duas policies de INSERT em `chat_messages` em uma única policy (`chat_messages_insert_participants_or_admin`) que respeita `c.blocked = false` para participantes e libera admin para moderação.
