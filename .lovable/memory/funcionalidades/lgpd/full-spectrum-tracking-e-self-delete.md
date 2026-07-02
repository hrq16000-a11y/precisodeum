---
name: Full-Spectrum Tracking & Self-Delete LGPD
description: Tracking forense unificado (UTM/referrer/network/movement/terms) + meta_tracking JSONB em providers + self-delete autenticado com cold storage 90d e block 180d
type: feature
---

## Coleta (registrationSnapshot.ts)
- `readNetworkInfo()` — Network Information API: connection_type/effectiveType, downlink_mbps, rtt_ms (Safari não suporta → null).
- `inferMovement(velocity_mps, accuracy_m)` — heurística: >1 m/s = em movimento; accuracy <50m = estático; senão null.
- `classifyReferrer(referrer, utm)` — `utm:<src>` | `organic:google` | `social:{instagram,facebook,linkedin,x,whatsapp,tiktok}` | `referral:<host>` | `direct` | `unknown`. Persistido em `origin_summary.referrer_kind`.
- `terms_accepted` + `terms_version` (`v1-2026-05`) gravados no clique Finalizar (e Skip) do `OnboardingV2Shell.tsx`. Gera `terms_accepted_at` ISO.

## RPC `record_registration_snapshot`
Atualizada para aceitar 5 colunas novas em `registration_snapshots`: `connection_type`, `connection_downlink_mbps`, `connection_rtt_ms`, `terms_version`, `terms_accepted_at`. Idempotência preservada (1 snapshot/usuário).

## `providers.meta_tracking` (JSONB)
Espelho leve gravado após o snapshot — sem PII bruta, fingerprint truncado a 16 chars:
```json
{
  "version": 1, "captured_at": "...",
  "attribution": { "referrer_kind": "...", "utm_*": "...", "came_from_link": true },
  "device": { "os_name", "os_version", "browser_name", "browser_version", "device_brand", "device_model", "ua_kind": "mobile|tablet|desktop|tv" },
  "screen": { "w","h","dpr" },
  "locale": { "language", "timezone" },
  "network": { "type", "downlink_mbps", "rtt_ms", "online" },
  "movement": { "was_moving", "velocity_mps", "accuracy_m" },
  "terms": { "accepted", "version", "accepted_at" },
  "fingerprint_short": "<16 chars>"
}
```
Index GIN em `idx_providers_meta_tracking`.

## Self-Delete (One-Click)
- RPC `self_delete_account(_reason)` SECURITY DEFINER, executável apenas por authenticated.
- Atômico: arquiva snapshot do profile+provider em `account_cold_storage` (purge_after = +90d), seta `profiles.status='banned_self_request'`, cria `registration_blocks` (180d) cruzando fingerprint+email+whatsapp+IP, e registra fila em `account_deletion_requests` (status `processando`, scheduled_for=+90d).
- UI em `/dashboard/privacidade` ("Excluir agora (1 clique)") — confirm nativo + signOut + redirect para `/`.

## Crons (pg_cron)
- `lgpd-purge-cold-storage` (03:30 diário) → `purge_cold_storage_91d()` deleta linhas com `purge_after < now()`.
- `lgpd-expire-registration-blocks` (03:35 diário) → `expire_registration_blocks_180d()` marca blocks expirados (não-permanentes) com sufixo `[expired]`.

## Tabela `account_cold_storage`
RLS: somente admin lê. Insert via SECURITY DEFINER (`self_delete_account`). Index em `purge_after` para o cron.

## O que NÃO foi tocado (já existia e funciona)
- `registration_snapshots` (UTM, referrer, IP, ISP, geo, dispositivo, OS, browser, screen, language, timezone, battery, fingerprint)
- `registration_blocks` + `admin_list_kill_switch_blocks` / `admin_reprocess_kill_switch_block`
- `account_deletion_requests` + edge `request-account-deletion`
- `user_access_logs` + edge `log-user-access`
- Página `/dashboard/privacidade` + `user-data-export` + LGPD consent bridge
- Triggers de imutabilidade do `registration_snapshots`

## Versão dos Termos
String literal `v1-2026-05` no shell. Mover para `site_settings.terms_version` numa próxima iteração se houver troca frequente.
