---
name: Sponsor ROI Layer
description: Atribuição leve sponsor→funil via sessionStorage; RPCs get_sponsor_roi/get_admin_sponsor_roi; painéis comerciais
type: feature
---

# Fase 2.3 — Sponsor ROI Layer

## Atribuição leve

- Quando um sponsor é clicado (`useSponsorsBySlot.trackClick`), `recordSponsorClick(sponsor_id, slot)` grava `sa:last_click = {sponsor_id, slot, ts}` em sessionStorage (TTL 30 min).
- Em `publicFunnelTelemetry.fire`, ações `profile_view` e `lead_submit` consultam `getActiveSponsorRef()` e anexam `_sponsor_ref` na RPC `record_public_funnel_event`. Search/category/city NÃO atribuem.
- Sem fingerprinting, sem cookies persistentes, sem PII. Última atribuição vence (last-write-wins).

## Schema/RPC

- `audit_log.details->>'sponsor_ref'` = UUID validado server-side (cast `::uuid`, descartado se inválido).
- `get_sponsor_roi(_sponsor_id uuid, _days int)`: owner ou admin. Retorna `{impressions, clicks, profile_views, lead_submits, ctr_*, top_slots, top_cities, by_day}`. CTR pipeline completo (impression→click→view→lead).
- `get_admin_sponsor_roi(_days int)`: admin-only. Top sponsors por leads, slots e cidades.
- Correção colateral: `get_public_funnel_telemetry` agora usa `event_date` (não `day`, que não existia em `sponsor_metrics`).

## UI

- `SponsorRoiPanel` (componente sponsor): narrativa comercial ("Você alcançou X · Y clicaram · Z visualizaram · W leads") + 4 KPIs + top slots + top cidades. Montado em `SponsorDashboardPage` antes das Quick Actions.
- `AdminSponsorRoiPanel` (componente admin): ranking de sponsors + slots + cidades. Montado no rodapé de `/admin/funil-publico`.

## Testes

- `src/__tests__/sponsor-attribution.test.ts` (4 testes): persist, TTL 30min, sponsor_id vazio, last-write-wins.

## Funil canônico

```
impression → click → profile_view → lead_submit
   ^                       ^             ^
   sponsor_metrics         audit_log(public_funnel + sponsor_ref)
```

`whatsapp_click` (lead_interactions) fica fora da atribuição na v1 — mantido como sinal de engajamento global.
