---
name: Auto-exclusão UX e relatórios meta_tracking
description: Modal vermelho com Select de motivo, seção "Seus Registros de Segurança" e admin oculto de qualidade meta_tracking
type: feature
---

# Fluxo de auto-exclusão e exportação de metadados

## Modal de exclusão (UX vermelho + motivo obrigatório)

- `src/components/dashboard/DeleteAccountDialog.tsx` substitui o `window.confirm()` antigo.
- AlertDialog vermelho com:
  - Mensagem: "arquivado por 90 dias (LGPD)" + "180 dias sem novo cadastro com mesmo WhatsApp/e-mail/dispositivo".
  - `Select` obrigatório (`data-testid="self-delete-reason"`) com 6 motivos canônicos: `no_longer_use`, `found_other_app`, `few_leads`, `privacy_concern`, `technical_issues`, `other`.
  - Quando `other`, exige textarea (≥ 3 chars) — payload vai como `other:<texto>` (truncado em 240 chars).
  - Botão `data-testid="self-delete-confirm"` chama `supabase.rpc('self_delete_account', { _reason })`, dispara toast de despedida, faz `signOut()` e redireciona para `/`.
- Trigger: botão "Excluir agora" em `/dashboard/privacidade` (`data-testid="open-self-delete"`).

## Transparência: "Seus Registros de Segurança"

- `src/components/dashboard/MetaTrackingSummary.tsx` (`data-testid="meta-tracking-summary"`) lê `providers.meta_tracking` (RLS) e mostra 4 cards:
  - **Origem do tráfego**: `referrer_kind` mapeado para labels PT-BR (`organic:google`, `social:instagram`, etc.) + UTM source/campaign.
  - **Conexão no cadastro**: `network.type`, `downlink_mbps`, `rtt_ms`.
  - **Movimento detectado**: `was_moving`, `velocity_mps`, `accuracy_m`.
  - **Termos vinculados**: `version`, `accepted_at`, status.
- Renderiza junto do `RegistrationDataSummary` (que continua dono do IP/ISP/dispositivo/Geo-IP).

## Admin oculto: qualidade meta_tracking

- Rota `/admin/meta-tracking-quality` (sem item de menu) protegida por `AdminGuard`.
- Página: `src/pages/admin/AdminMetaTrackingQualityPage.tsx`.
- RPC `public.admin_meta_tracking_quality()` (SECURITY DEFINER, exige `has_role('admin')`, GRANT só p/ `authenticated`) retorna JSONB com:
  - `totals`: `providers_total`, `providers_with_meta`, `coverage_pct`, `last7_with_meta`.
  - `field_coverage`: presença por sub-objeto (`attribution`, `network`, `movement`, `terms`, `network_type`, `referrer_kind`).
  - `connection_type` / `device_type` / `referrer_kind`: arrays `{key, count}` ordenados por contagem.
  - `movement`: `in_field`, `sampled`, `in_field_pct`.
  - `gps_accuracy_by_category`: top 30 categorias com média de `gps.accuracy_m`.
- **Alerta de degradação** (`data-testid="meta-tracking-degraded"`) quando `coverage_pct < 60`.

## Blindagem de reentrada (LoginPage)

- `LoginPage` continua usando `check_registration_block(_email, _whatsapp)` antes de criar conta.
- Mensagem do toast agora cita **explicitamente** os 3 vetores ("e-mail, WhatsApp ou dispositivo"), exibe `days_remaining` e o `reason` quando presente. Duração 9s.

## Não criado nesta iteração (reservado para próximas)

- Testes E2E do `self_delete_account` (deslogio, cold storage, bloqueio 180d).
- Testes de RLS para `account_cold_storage` / `system_audit_logs` / `providers.meta_tracking`.
- Validação dos crons `purge_cold_storage_91d` / `expire_registration_blocks_180d`.
