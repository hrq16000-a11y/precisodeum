---
name: OG image variants e dedupe de leads
description: Trigger DB notify_provider_on_new_lead com UNIQUE INDEX por (user_id, link); helper buildOgImage seleciona ratio por UA (wide/square) com Image Transforms; UI de preferências expõe regras anti-spam + histórico de leads recentes.
type: feature
---

## Notificação automática de novos leads

- Trigger `trg_notify_provider_on_new_lead` (AFTER INSERT em `public.leads`)
  → função `notify_provider_on_new_lead` SECURITY DEFINER.
- Insere `notifications(type='lead', link='/dashboard/leads/{id}')` para `provider.user_id`.
- Dedupe forte: `UNIQUE INDEX uniq_notifications_user_lead_link ON notifications(user_id, link) WHERE type='lead' AND link IS NOT NULL`.
- Respeita opt-out de canal in-app via `providers.notification_channels->>'in_app' = false`.
- `EXCEPTION WHEN OTHERS` para nunca derrubar o INSERT do lead.

## OG variants por User-Agent

- Helper `supabase/functions/og-profile/buildOgImage.ts` exporta `pickOgRatio(ua)` e `buildOgImage(url, ratio)`.
- Wide (1200x630): Facebook, Twitter, default. Twitter card = `summary_large_image`.
- Square (1080x1080): WhatsApp, LinkedIn, Telegram, Discord, Slack, Skype. Twitter card = `summary`.
- Edge `og-profile` aplica `?width&height&quality=82&resize=cover` sobre URLs do Storage; URLs externas (Google avatars) caem no fallback original.
- ETag muda por ratio → `Vary: User-Agent` força o CDN a servir variantes corretas.

## Validação e segurança

- Slug regex `^[a-z0-9][a-z0-9-]{1,79}$` aplicado em `og-profile` após sanitização.
- Crawler com slug inválido → 400 `{error:"invalid_slug"}` + `Cache-Control: max-age=3600`.
- Humano com slug vazio → 302 para home (UX amigável).
- **Sem rate limiting backend** (diretriz do projeto). Cache 304 + s-maxage=600 + SWR=24h já protege.

## UI

- `DashboardNotificationPreferencesPage` mostra resumo dinâmico das regras
  (modo + intervalo) num bloco tracejado e adiciona `RecentLeadsHistory` —
  últimos 10 leads do provider via Realtime (INSERT em `leads`).

## Testes

- `src/test/buildOgImage.test.ts` — 12 tests Vitest (ratio por UA, transforms, edge cases).
- `supabase/functions/og-profile/index.test.ts` — 11 tests Deno (E2E contra endpoint deployado): humano 302, wide 1200x630 + summary_large_image, square 1080x1080 + summary, ETag 304, slug inválido 400, ETags distintos por ratio.
- Asserção de Content-Type usa `text/*` (gateway pode reescrever para text/plain).
