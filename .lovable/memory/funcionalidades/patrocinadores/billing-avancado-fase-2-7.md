---
name: Sponsor Billing avançado (Fase 2.7)
description: Planos com cotas, cálculo por período+performance, faturas automáticas e notificações de cobrança
type: feature
---

# Fase 2.7 — Sponsor Billing avançado

Extensão da Fase 2.5 (que criou `sponsor_billing_cycles`) sem quebrar contratos
anteriores. Tudo incremental, sem gateway externo.

## Planos (`sponsor_plans` estendido)

Novos campos:
- `duration_days` (default 30)
- `budget_limit` numeric — teto total por ciclo (base + performance)
- `performance_rate_per_lead` numeric — valor por lead atribuído ao patrocinador
- `included_cities` / `included_categories` jsonb — escopo de veiculação
- `max_slots_per_city` / `max_slots_per_category` — cotas duras por contexto

## Ciclos estendidos (`sponsor_billing_cycles`)

Novos campos: `base_amount`, `performance_amount`, `performance_leads`, `breakdown jsonb`.
RPC `compute_sponsor_cycle_amount(_cycle_id)` calcula:
- base = `price_yearly` ou `price_monthly` do plano (conforme `billing_cycle`)
- performance = SUM(`sponsor_metrics.count`) em (`lead`/`lead_submit`/`conversion`) no período × `performance_rate_per_lead`
- aplica `budget_limit` como teto

## Faturas (`sponsor_invoices`)

Nova tabela com `invoice_number bigserial`, `total_amount`, `status`
(`issued|paid|void|refunded`), `items jsonb`, `pdf_url`, ligando a `billing_cycle_id`
e/ou `change_request_id`. RLS: admin total + sponsor lê via `sponsor_contacts`.

Helpers SECURITY DEFINER:
- `generate_invoice_for_cycle(_cycle_id)` — gera fatura a partir de um ciclo
- `admin_generate_invoice_for_change_request(_id, _amount, _note)` — admin emite manualmente
- `list_sponsor_invoices(_sponsor_id, _limit)` — leitura paginada
- **Trigger** `trg_sponsor_change_request_auto_invoice`: ao aprovar uma solicitação
  cujas `changes` contenham `plan_id` / `duration_days` / `budget_limit` /
  `billing_cycle`, emite um **recibo** automático (`status=paid`, `total=0`).

## Notificações

Helpers reutilizáveis:
- `notify_sponsor_contacts(_sponsor_id,type,title,message)` → `sponsor_notifications`
- `notify_admins_about_sponsor(_sponsor_id,type,title,message,link)` → `notifications`

Triggers:
- `trg_billing_status_change_notify` — em mudança de status do ciclo
  (`overdue/awaiting_payment/expired/paid/grace`): notifica sponsor; **admins
  recebem apenas em casos críticos** (`overdue`, `expired`).
- `trg_billing_renewal_notify` — quando `renewal_requested` vira `true`: avisa
  sponsor (recebido) e admins (acionar).
- `trg_payment_failed_notify` — em `sponsor_payments.status='failed'`: notifica
  ambos os lados.

## UI

- **`SponsorInvoicesCard`** acoplado ao final de `/sponsor-panel/faturamento`.
- **`AdminRecentInvoicesCard`** acoplado ao final de `/admin/sponsor-billing`.
- KPIs e tabela do admin permanecem intactos.

## Compatibilidade

- Nada renomeado; helpers da 2.5 (`get_sponsor_billing_status`,
  `admin_mark_billing_paid`, `sponsor_request_renewal`) seguem inalterados.
- Triggers usam `EXCEPTION WHEN OTHERS THEN NULL` para não bloquear o caminho
  feliz se uma notificação falhar.

## Fora de escopo

- Gateway de pagamento real (Stripe/Pix automático)
- Cobrança recorrente sem intervenção humana
- Geração de PDF server-side (campo `pdf_url` fica reservado)
- Atribuição refinada lead → sponsor (usa contadores já agregados em
  `sponsor_metrics`; se for necessário diferenciar lead orgânico de lead
  patrocinado, fica para uma fase futura)
