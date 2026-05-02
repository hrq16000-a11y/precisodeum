---
name: Histórico imutável de privacidade & bloqueio detalhado
description: Tabela user_privacy_history (RLS owner-only, INSERT só via SECURITY DEFINER) + RPC record_privacy_event + check_registration_block estendido (expires_at, matched_via, blocked_at) + mensagem detalhada de bloqueio no LoginPage com data PT-BR e instruções.
type: feature
---

## Tabela `user_privacy_history`
- 6 event_types: `account_deletion | data_export | consent_change | block_triggered | block_expired | login_blocked`.
- RLS: owner SELECT (auth.uid=user_id) + admin SELECT. INSERT/UPDATE/DELETE bloqueados pelo client (only SECURITY DEFINER).
- Índices: (user_id, created_at DESC) e (event_type, created_at DESC).

## RPCs
- `record_privacy_event(_event_type, _reason, _metadata, _ip_address, _user_agent)` — único caminho de write a partir do client (best-effort, falha silenciosa via `src/lib/privacyHistory.ts`).
- `self_delete_account` agora insere automaticamente um `account_deletion` no histórico com `block_expires_at`, `block_days=180`, `cold_storage_days=90`.
- `check_registration_block` retorna agora: `blocked`, `reason`, `matched_via` (email/whatsapp/unknown), `permanent`, `expires_at` (ISO), `blocked_at`, `days_remaining`.

## UI
- `PrivacyHistoryTimeline.tsx` em /dashboard/privacidade — Realtime (postgres_changes INSERT filtrado por user_id), até 50 eventos, ícone Lucide por tipo, detalhes técnicos colapsáveis.
- `DashboardPrivacyPage` chama `recordPrivacyEvent({event_type:'data_export'})` após download bem-sucedido do JSON.
- `LoginPage` formata mensagem detalhada de bloqueio: vetor (email/WhatsApp/dispositivo) + data ISO em PT-BR (`day:'2-digit', month:'long', year:'numeric'`) + dias restantes + motivo humanizado (`self_deletion_180d → "exclusão voluntária de conta (LGPD)"`) + link `/ajuda`. Toast com duração 12s.

## Testes (33 verdes)
- `self-delete-e2e.test.tsx` (5)
- `lgpd-rls-imutability.test.ts` (11)
- `meta-tracking-and-privacy-rls.test.ts` (10) — scan estático garante zero write paths em meta_tracking/user_privacy_history e que `admin_meta_tracking_quality` só é chamado em `/pages/admin/`.
- `login-block-message-detailed.test.ts` (7) — valida vetor, formato pt-BR, humanização, instruções e duração do toast.
