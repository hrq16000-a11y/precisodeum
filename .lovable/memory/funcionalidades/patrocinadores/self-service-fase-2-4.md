---
name: Sponsor Self-Service Fase 2.4
description: Patrocinadores editam criativos/contato via fluxo draft+approval, admin revisa em /admin/sponsor-change-requests com diff e snapshot imutável
type: feature
---

# Sponsor Self-Service — Fase 2.4

## Escopo liberado (whitelist server-side em `sponsor_submit_change_request`)
`image_url`, `logo_url`, `link_url`, `external_link`, `phone`, `whatsapp`,
`short_description`, `full_description`, `linked_city`, `linked_category`,
`renewal_requested` (meta, não aplicado em `sponsors`).

## Bloqueado (admin-only)
`tier`, `position`, `display_order`, `active`, `start_date`, `end_date`,
`plan`, `plan_tier`, `status`, `guaranteed_impressions`, pacing, billing.

## Fluxo
1. Patrocinador edita em `/sponsor-panel/editar` (form zod).
2. RPC `sponsor_submit_change_request` valida ownership + whitelist + rate-limit (5/24h) + single-pending-lock.
3. Snapshot atual de `sponsors` é congelado em `current_snapshot` no momento do submit (evita race condition).
4. Admin revisa em `/admin/sponsor-change-requests` (diff antes/depois) e chama `admin_review_sponsor_change_request(_id,_decision,_comment)`.
5. Approved → UPDATE dinâmico só nos campos whitelisted; rejected → snapshot preservado.
6. Tudo gera linha em `audit_log` (`resource_type='sponsor_change_request'`) + notificação para sponsor e admins.

## Segurança
- Tabela com RLS: sponsor lê próprias requests; UPDATE direto só admin (mas apply real é via RPC SECURITY DEFINER).
- INSERT só via RPC (sem policy de INSERT).
- Unique index parcial `WHERE status='pending'` impede 2ª pendente simultânea.
- Whitelist re-validada server-side, blindando contra payload arbitrário do client.
- Sponsor não pode alterar `sponsor_id` alheio (checagem via `sponsor_contacts`).

## UI
- `SponsorChangeRequestForm` — react-hook-form + zod.
- `SponsorChangeRequestList` — histórico com badges + cancelar pendente.
- `SponsorAlertsCard` — campanha expirando ≤7d, banner ausente, pacing crítico, pendências.
- `AdminChangeRequestDiff` — tabela 3 colunas (Campo / Antes / Depois) sobre `current_snapshot` imutável.
- Link "Editar campanha" no `SponsorLayout`.

## Performance
- Lazy import de `SponsorSelfServicePage` e `AdminSponsorChangeRequestsPage` no `App.tsx`.
- Sem realtime/polling. Queries com `limit(20|50)`.

## Dependências manuais restantes
- Billing/renovação real (apenas pedido via `renewal_requested=true`).
- Tier/slot/pacing/inventory.

## Maturidade
**Operacional** — sponsor edita criativos/contato sem admin; admin mantém controle de billing/inventory.

## Próximo gargalo recomendado
**Sponsor Billing Layer** — fechar loop comercial automatizando renovação/cobrança.

## Testes
- `src/__tests__/sponsor-self-service.test.ts` — whitelist, schema zod, diff.
