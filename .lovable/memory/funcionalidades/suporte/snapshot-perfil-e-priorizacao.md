---
name: Suporte · Snapshot do perfil + priorização ORGÂNICA (sem plano para prestador)
description: support_tickets.context.profile_snapshot inclui requester_kind ('sponsor'|'provider'|'client'|'other') e bloco sponsor isolado (sponsor_tier/sponsor_status). UI admin filtra/ordena por TIPO+NÍVEL — nunca por plano para prestadores. current_plan deprecated, mantido só para auditoria histórica.
type: feature
---

## Regra de negócio (CRÍTICA)
- **Prestadores são 100% gratuitos.** Nunca filtrar/destacar/ordenar por "plano pago".
- **Patrocinadores são pagantes por definição.** Rótulo "Patrocinador" basta — sem badge "Pago".
- Priorização orgânica (sort `organic_priority`):
  1. Patrocinadores (`requester_kind='sponsor'`)
  2. Prestadores Ouro+ (level ∈ Ouro/Platina/Diamante/Mestre)
  3. Demais prestadores
  4. Outros (cliente etc.)

## Captura — `src/lib/supportContext.ts`
`enrichSupportContext(ctx, userId)` agora consulta também `sponsor_leads` (id, plan) e classifica `requester_kind`:
- `sponsor` se houver linha em `sponsor_leads`
- `provider` se houver `providers.slug` ou `profile_type ∈ {provider, agency}`
- `client` se `profile_type === 'client'`
- `other` caso contrário

Quando `sponsor`, popula bloco isolado `snapshot.sponsor = { sponsor_tier, sponsor_status }`. **Nunca** preenchido para prestador.

`current_plan` continua gravado (auditoria histórica em `support_context_snapshot_log`) mas é `@deprecated` para uso de UI.

## Admin Panel — `AdminSupportTicketsPanel.tsx`
- **Filtro Tipo** (substitui o antigo "Plano"): `Todos | Patrocinadores | Prestadores Ouro+ | Demais prestadores` via `context->profile_snapshot->>requester_kind` + `account_level`. "Demais prestadores" exclui Ouro+ via pós-filtro client-side.
- **Filtro Nível**: mantido (lista de gamification_levels).
- **Ordenação**: `recent` (default) ou `organic_priority` (Postgrest desc por requester_kind + reordenação client-side para subir Ouro+).
- **Visual por linha**:
  - Sponsor → badge `<Megaphone>` "Patrocinador [tier]" + borda `border-l-primary` + bg-primary/5
  - Prestador Ouro+ → badge `<Trophy>` com nome do nível + borda âmbar
  - Demais → sem destaque
- **Detalhe**: badge "Patrocinador [tier]" (`<Megaphone>`) só renderiza para `requester_kind='sponsor'`. Badge `current_plan` (BadgeCheck) **REMOVIDO**.

## Removidos / Depreciados
- `isPaidPlan()` helper, `PAID_PLAN_KEYWORDS`, sortBy `plan_priority`, planFilter `paid|gratuito`, badge `<Star>` "Plano pago", classe `border-l-amber-500/70` ligada a plano de prestador.
- Ícones removidos do import: `Star`, `BadgeCheck`. Adicionado `Megaphone`.

## Testes
- `support-context-enrich.test.ts` (7): classificação provider/sponsor/other, isolamento de `sponsor` extras, current_plan preservado p/ auditoria, falha de rede tolerada, round-trip session.
- `admin-support-priority.test.ts` (3, NOVO): rank sponsor > Ouro+ > demais > outros; current_plan='premium' em prestador NÃO eleva prioridade; snapshot ausente não quebra.

## Sem migration
JSONB livre — apenas novas chaves no snapshot. `support_context_snapshot_log` inalterado.
