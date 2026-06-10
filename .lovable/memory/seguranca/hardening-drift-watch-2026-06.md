---
name: Security Hardening · Drift Watch & Findings Page
description: REVOKE EXECUTE em admin_*/staff_*; tabela rls_drift_alerts + cron capture_rls_drift (04:00 UTC); /admin/security-findings combinando catálogo auditado + drift; deno test rls_regression_test.ts; CI workflow security-headers.yml + scripts/check-security-headers.mjs.
type: feature
---

# Security Hardening 2026-06

## Hardening DB (migration 20260610063323)
- `REVOKE EXECUTE ... FROM anon` em todas funções `admin_*`/`staff_*` + detectors críticos (`detect_onboarding_regressions`, `evaluate_onboarding_experiments_kill_switch`, `run_integrity_check`, `refresh_sponsor_billing_status`). `authenticated` mantém execute (RPCs validam `has_role`).
- `public.rls_drift_alerts` (admin-only RLS) com colunas: category/object_kind/object_name/role_name/before_state/after_state/severity/acknowledged.
- `public.capture_rls_drift()` SECURITY DEFINER faz snapshot de `pg_policies` + funções SECDEF, compara contra `rls_policy_snapshots` mais recente, insere alertas e notifica admins via `notifications` (type `security_drift`, link `/admin/security-findings`).
- Cron `capture-rls-drift-daily` (`0 4 * * *`).

## UI
- `/admin/security-findings` (guarded) com 3 KPIs (corrigidos / risco aceito / drift não-ack) + 2 tabs:
  - **Catálogo**: 8 itens estáticos (4 fixed da rodada anterior + admin funcs fixed + 3 ignored com justificativa).
  - **Drift**: lista `rls_drift_alerts` com botão "OK" (ack via UPDATE; permitido pela policy).

## Testes
- `supabase/functions/_tests/rls_regression_test.ts` (Deno) — 7 testes anon: CPF/CNPJ/birth_date bloqueados, UPDATE sponsor_leads bloqueado, INSERT system_audit_logs bloqueado, RPCs admin_* bloqueadas, rls_drift_alerts bloqueado, colunas públicas providers OK.

## CI
- `.github/workflows/security-headers.yml` em PR/push/cron 05:00 UTC chama `scripts/check-security-headers.mjs` (BASE_URL=https://precisodeum.com.br por default) validando CSP / X-Content-Type-Options / Referrer-Policy / X-Frame-Options em `/`, `/buscar`, `/categoria/eletricista`, `/login`, `/admin`.

## Notas
- Linter Supabase ainda lista ~350 funções SECDEF públicas — **risco aceito**, documentado em security_memory. São RPCs de busca/SEO/CEP que precisam de bypass controlado.
- Extension in Public também ignorada (padrão Supabase).
