---
name: CRUD de páginas programáticas, overrides SEO e otimização local
description: Tabela programmatic_page_overrides, edição de title/meta/JSON-LD em /admin/seo, CRUD + reindexação em /admin/cidades e /admin/otimizacao-local
type: feature
---

- Tabela `public.programmatic_page_overrides` (unique por `path`; leitura pública, escrita só admin via `has_role`; trigger `trg_touch_ppo`). Campos: `enabled`, `title`, `meta_description`, `keywords`, `editorial_note`.
- `src/lib/seo/programmaticOverrides.ts`: `useProgrammaticOverride(path)`, `useProgrammaticOverrides()`, `applyOverrideToSeo`, `isOverrideDisabled`. `HandymanServicePage` aplica o override no title/description/keywords e força `noindex` quando `enabled=false`.
- `src/hooks/useProgrammaticInventory.ts` é a fonte única do inventário elegível (gate cidade ≥1 / bairro ≥2, igual ao sitemap), consumido por `ProgrammaticPagesTab`, `ProgrammaticSeoTab` e `/admin/otimizacao-local`.
- `ProgrammaticOverrideDialog` cria/edita/remove personalizações e chama `reindexSitemaps()` (`src/lib/seo/reindexSitemaps.ts` → edge `gsc-submit-sitemaps`, aceita admin autenticado e registra em `gsc_audit_log`).
- Aba "Páginas programáticas" em `/admin/seo` mostra title, meta description e JSON-LD efetivo com edição imediata.
- `/admin/otimizacao-local` (`AdminLocalOptimizationPage` + `src/lib/seo/localKeywordIdeas.ts`): keywords determinísticas por intenção (transacional/urgência/preço/hiperlocal/informacional) e pautas editoriais por cidade × vertical. Sem IA.
- Wizard já persiste no banco; exibição pública continua restrita a `providers.status = 'approved'` (auto-aprovação controlada por `site_settings.auto_approve_providers`).
