---
name: Suporte · Snapshot do perfil + priorização por plano
description: support_tickets.context.profile_snapshot (slug/plan/level/points/type) com auditoria em support_context_snapshot_log; AdminSupportTicketsPanel filtra por plano (paid/gratuito), nível e ordena por plano (pagos primeiro). Linha destacada com borda âmbar quando plano pago.
type: feature
---

## Captura
`enrichSupportContext(ctx, userId)` em `src/lib/supportContext.ts` lê `profiles` (commercial_plan, engagement_points, level_id, profile_type), `providers` (slug, plan) e `gamification_levels` (name) — best-effort. Snapshot anexado a `pendingCtx.profile_snapshot` antes do UPDATE em `support_tickets.context`.

## Auditoria
Tabela `support_context_snapshot_log` (ticket_id, user_id, profile_slug, current_plan, account_level, snapshot jsonb, created_at). RLS: SELECT dono ou admin; INSERT só pelo dono do ticket. Gravado em `DashboardSupportPage.handleSend` após o UPDATE do contexto.

## Admin Panel
- Filtros: plano (`all|paid|gratuito` via `context->profile_snapshot->>current_plan`) e nível (lista de gamification_levels).
- Ordenação: `recent` (default) ou `plan_priority` (current_plan desc, nullsFirst=false).
- Visual: borda esquerda âmbar + bg-amber-500/5 + badge `<Star>` para `isPaidPlan` (heurística: contém pro/premium/plus/gold/vip/pago).
- Ícones: Filter/Star/Trophy/ArrowDownUp/UserCircle2/BadgeCheck/Sparkles/ExternalLink — todos Lucide com `aria-label`/`aria-hidden`.

## Testes
- `src/test/support-context-enrich.test.ts` (6): snapshot completo, sem perfil (nulls), sem userId, falha de rede, fallback provider.plan, round-trip save/consume.
- `src/test/support-ticket-queries.test.ts` (6) + `support-ticket-rules.test.ts` (8): contrato preservado.
