---
name: Limiares GSC, templates de e-mail e conversão por rota
description: Alertas configuráveis do Search Console, editor de templates Resend no admin e relatório de conversões de contato por rota/categoria
type: feature
---

- **Limiares GSC**: `src/lib/seo/gscThresholds.ts` (puro) + `GscThresholdAlertsCard` exibido em `AdminSeoHealthPage`. Configuração persistida em `site_settings.gsc_alert_thresholds` (JSON: minIndexedRatio/minImpressions/minClicks/maxSitemapErrors). Métrica sem dado = `unknown` (nunca alerta falso). 8 testes em `src/__tests__/gsc-thresholds.test.ts`.
- **Templates de e-mail**: tabela `email_templates` (key/name/subject/html/enabled, RLS admin-only) + `/admin/email-templates` com editor, preview em iframe sandbox e lista das últimas entregas de `email_events` (webhook Resend).
- **Conversão por rota**: RPC `get_contact_conversion_report(_days,_provider_id)` agrega `contact_clicks` por rota, categoria e tipo de profissional (company x individual). Consumida por `ContactConversionReport` dentro de `ProviderAnalyticsGrid`; admin sem `_provider_id` vê tudo, prestador só o próprio.
- **Segurança**: trigger `trg_guard_sponsor_moderation` impede que patrocinadores alterem status/plan_tier/impressões (só admin/service_role).
