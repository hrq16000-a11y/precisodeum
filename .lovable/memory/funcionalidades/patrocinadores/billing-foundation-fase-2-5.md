---
name: Sponsor Billing Foundation (Fase 2.5)
description: Pipeline operacional de cobrança/renovação SEM gateway — tabela sponsor_billing_cycles, RPCs e cron diário
type: feature
---

# Fase 2.5 — Sponsor Billing Foundation + Renewal Ops

Camada operacional auditável entre o ROI (Fase 2.3), o self-service (Fase 2.4) e a futura
integração com gateway financeiro (Fase 3+). **Nenhum pagamento automático nesta fase.**

## Modelo

`public.sponsor_billing_cycles` — um registro por ciclo de cobrança:

- `sponsor_id`, `subscription_id` (opcional)
- `cycle_start` / `cycle_end`
- `amount`, `payment_method`, `invoice_reference`
- `status`: `pending | awaiting_payment | paid | overdue | grace | cancelled | expired`
- `renewal_requested` + `renewal_requested_at`
- `grace_until`, `paid_at`, `admin_note`
- índices: `(sponsor_id, status, cycle_end desc)`, `(status, cycle_end)`, parcial `(renewal_requested)`

## RPCs

| Função | Quem chama | Efeito |
|---|---|---|
| `sponsor_request_renewal(_sponsor_id)` | Sponsor (owner via `sponsor_contacts`) ou admin | Cria/marca ciclo como renovação solicitada + audit_log |
| `admin_mark_billing_paid(_cycle_id, _method, _ref, _note)` | Admin | Marca pago + audit_log |
| `admin_update_billing_cycle(_cycle_id, _status, _grace_until, _note)` | Admin | Atualiza para `grace/cancelled/expired/...` + audit_log |
| `get_sponsor_billing_status(_sponsor_id)` | Sponsor owner ou admin | Retorna `{health, days_left, current_cycle, subscription, history[]}` |
| `refresh_sponsor_billing_status()` | Cron/service_role | Atualiza overdue/expired em lote (idempotente) |

## Health calculado (server + helper TS)

`src/lib/sponsorBilling.ts::computeHealth` é fonte única no client; o SQL replica a mesma lógica:

1. `expired/cancelled` ou ciclo já vencido sem grace → **expired**
2. `grace` → **grace**
3. `overdue/awaiting_payment` → **awaiting_payment**
4. pago e ≤7 dias até vencer → **expiring_soon**
5. ≤7 dias do vencimento → **expiring_soon**
6. resto → **healthy**

## UI

- **Sponsor**: `/sponsor-panel/faturamento` (`SponsorBillingPage`) com ciclo atual, instruções
  Pix/manual, histórico (12 ciclos) e botão "Solicitar renovação".
- **Card no Dashboard**: `SponsorBillingCard` mostra health + dias restantes + CTA.
- **Admin**: `/admin/sponsor-billing` (`AdminSponsorBillingPage`) com KPIs (overdue, grace,
  renovação solicitada), filtros (expiring_soon, renewal_requested, status), tabela paginada
  (200), diálogos "Confirmar pagamento" e "Atualizar ciclo".

## Cron

`refresh-sponsor-billing-status-daily` (pg_cron, 03:30 UTC) executa
`SELECT public.refresh_sponsor_billing_status();` — sem edge function nova.

## Segurança

- Sponsor **nunca** altera `amount`, `status`, `paid_at` direto (RLS bloqueia UPDATE/DELETE).
- Sponsor só lê próprios ciclos via `sponsor_contacts`.
- RPCs `SECURITY DEFINER` com `search_path=public`, ownership-checked.
- `refresh_sponsor_billing_status` é `REVOKE ALL FROM PUBLIC` + `GRANT TO service_role`.

## Performance

- Lazy routes (admin + sponsor).
- Sem realtime, sem polling.
- Queries indexadas em (sponsor_id, status, cycle_end).
- Histórico limitado a 12 ciclos.

## Escopo NÃO incluído nesta fase

Stripe, MercadoPago, Pix automático, webhook, assinatura recorrente, invoices PDF,
antifraude financeiro, split payment. Tudo isso entra na fase de gateway dedicada.

## Próxima fase recomendada (2.6)

Conversion Optimization Runtime Real — ranking por conversão, boost automático, CTA
experiments, priorização de sponsors por ROI. A camada financeira operacional já é sólida
para sustentar essas decisões.
