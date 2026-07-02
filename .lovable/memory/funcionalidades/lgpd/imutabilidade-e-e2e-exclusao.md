---
name: Imutabilidade LGPD & E2E exclusão
description: Blindagem de system_audit_logs/account_cold_storage/registration_blocks contra UPDATE/DELETE pelo client + crons LGPD + testes E2E do botão "Excluir agora"
type: feature
---

## Imutabilidade (RLS + trigger)
- `system_audit_logs`: policies `no_update_*`/`no_delete_*` para authenticated/anon + trigger `prevent_audit_log_tampering` (BEFORE UPDATE/DELETE) que rejeita quando JWT role ∈ {authenticated, anon}.
- `account_cold_storage`: policies negam INSERT/UPDATE/DELETE para client. Apenas `self_delete_account` (SECURITY DEFINER) e cron de purga gravam.
- `registration_blocks`: client nem lê fora do próprio bloqueio nem grava. Cron `expire_registration_blocks_180d` zera expirados.

## Cron jobs (pg_cron)
- `purge-cold-storage-91d` — diário 03:30 → `purge_cold_storage_91d()`.
- `expire-registration-blocks-180d` — diário 03:45 → `expire_registration_blocks_180d()`.

## MetaTrackingSummary realtime
- Inscrição em `postgres_changes` (UPDATE em providers, filter user_id) atualiza painel imediatamente.
- Badge "Atualizado: …" exibe `updated_at` no canto superior direito.

## Testes
- `src/test/self-delete-e2e.test.tsx` (5): canSubmit, payload `other:`, contrato banned_self_request + 90d cold + 180d block, erro do RPC não desloga.
- `src/test/lgpd-rls-imutability.test.ts` (11): scan estático garante que a UI nunca emite update/insert/delete em audit/cold/blocks; valida nomenclatura de cron.
- 16/16 verdes.
