# Auditoria de Saúde — 2026-06-18

Escopo: revisão rápida pós-hardening de segurança. Sem mudanças aplicadas — somente diagnóstico priorizado.

## 1. Segurança

| Camada | Status | Observação |
|---|---|---|
| Scanners persistidos (agent/connector/Wiz/Supabase) | ✅ 0 findings | Última varredura limpa. |
| Supabase linter | ⚠️ 351 WARN | 350 × "SECURITY DEFINER executable by anon" + 1 × "Extension in public". Já aceitos como padrão arquitetural (RLS + `has_role`). EXECUTE de funções `admin_*`/`staff_*` foi revogado na migração `20260610063317`. |
| Drift watch | ✅ Ativo | `pg_cron` 04:00 UTC → `rls_drift_alerts` + notifica admins. |
| RLS regression tests | ✅ | `supabase/functions/_tests/rls_regression_test.ts`. |
| CI security headers | ✅ | `.github/workflows/security-headers.yml`. |
| Vulnerabilidades npm | ✅ 0 high/critical | `bun audit` limpo. |

**Recomendação**: nenhuma ação imediata. Próximo ciclo: revisar a extensão fora de `public` (mover `pg_trgm`/`unaccent` para schema `extensions`) — refator de baixo risco mas requer migration cuidadosa.

## 2. Qualidade de Código

| Métrica | Valor | Risco |
|---|---|---|
| Runtime errors ativos | 0 | ✅ |
| TODO/FIXME/HACK em `src/` | 0 | ✅ |
| `@ts-ignore` / `@ts-nocheck` | 0 | ✅ |
| `console.log` fora de testes | 1 (App.tsx) | 🟡 Avaliar remoção. |
| `: any` explícito | 304 ocorrências (top 10 abaixo) | 🟡 Tipar incrementalmente. |

Top arquivos com `: any`:
- `src/pages/AdminAdSlotsPage.tsx` — 40
- `src/pages/ProviderProfile.tsx` — 28
- `src/pages/AdminSponsorsPage.tsx` — 26
- `src/pages/DashboardServicesPage.tsx` — 20
- `src/pages/AdminJobsPage.tsx` — 20
- `src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx` — 17
- `src/components/admin/UserDetailSheet.tsx` — 17

## 3. Arquitetura / Manutenibilidade

Arquivos monolíticos > 1500 linhas (candidatos a split por responsabilidade):

| Arquivo | Linhas | Sugestão |
|---|---|---|
| `src/integrations/supabase/types.ts` | 11.172 | Auto-gerado — ignorar. |
| `src/lib/citiesIndexData.ts` | 5.300 | Dataset estático — manter. |
| `OnboardingV2Shell.tsx` | 2.509 | Extrair handlers/efeitos para hooks (`useV2Autosave`, `useV2Telemetry`). |
| `ProviderProfile.tsx` | 2.404 | Já tem `sections/` — mover blocos restantes (header/CTA/related) para subcomponentes. |
| `AdminSponsorsPage.tsx` | 1.910 | Dividir por aba (Leads/Campanhas/Faturamento). |
| `AdminBackupPage.tsx` | 1.867 | Extrair `BackupTable` + `RestoreDialog`. |
| `UserDetailSheet.tsx` | 1.809 | Separar em tabs (Identidade/Permissões/Auditoria/Privacidade). |
| `DashboardServicesPage.tsx` | 1.784 | Wizard já modular; extrair lista e filtros. |
| `SearchPage.tsx` | 1.653 | Extrair `useSearchQueryState` + `SearchResultsGrid`. |
| `AdminOnboardingOpsPage.tsx` | 1.636 | Já em sub-abas — extrair painéis. |
| `useProviders.tsx` | 1.542 | Quebrar por intenção (search/nearby/featured). |

## 4. Acessibilidade

- `<img>` com `alt=""` decorativos: ok semanticamente, mas em `AdminBlogPage.tsx` e `AdminLayout.tsx` o avatar/cover representa conteúdo — usar `alt={post.title}` / `alt={profile.full_name}`. 🟡 Correção barata.
- Sem outros achados de A11y críticos no scan rápido.

## 5. Performance

- `deps: 80` / `devDeps: 25` — saudável para um app deste porte.
- Sem regressões reportadas em `web_vitals_log`/CI Lighthouse desde último checkup (2026-04-28).
- Risco latente: bundles dos arquivos > 1500 linhas em rotas admin (já lazy-loaded em `adminRoutes.tsx`, então impacto fora do admin é nulo).

## 6. Próximas ações sugeridas (priorizadas)

1. **🟢 Quick wins (1-2h cada)**:
   - Trocar `alt=""` por texto descritivo nos avatares/covers (AdminBlogPage, AdminLayout).
   - Remover `console.log` órfão em `App.tsx`.
2. **🟡 Refactor médio (1 sprint)**:
   - Tipar `any` em `AdminAdSlotsPage.tsx` + `ProviderProfile.tsx` (66 ocorrências = 22% do total).
   - Split de `OnboardingV2Shell.tsx` em hooks dedicados.
3. **🔵 Refactor grande (2+ sprints)**:
   - Quebra dos 8 monólitos admin > 1500 linhas.
   - Mover extensões de `public` para schema `extensions` (migration coordenada).

## 7. O que está saudável (manter)

- 0 runtime errors, 0 TODOs, 0 `@ts-ignore`.
- Memória de governança ampla e atualizada (157 entradas).
- Cobertura de testes alta em Vitest + Deno + Playwright.
- Pipelines CI completos: security-headers, performance, prerender, smoke, onboarding-timers-lint.
- Drift watch + RLS regression rodando.
