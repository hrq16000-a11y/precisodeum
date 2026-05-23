---
name: Sprint A — Auditoria do Funil Público
description: Auditoria read-only do pipeline public_funnel. Root cause de public_funnel=0 identificado.
type: feature
---

# Sprint A — Auditoria do Funil Público (read-only)

## TL;DR (root cause único, 100% determinístico)

A RPC `public.record_public_funnel_event` tem **duas overloads ambíguas**
coexistindo no banco — uma de 8 argumentos e outra de 9 (com `_sponsor_ref`).
**Ambas** declaram TODOS os parâmetros (exceto `_action`) com `DEFAULT NULL`.

Resultado: qualquer chamada via PostgREST (`supabase.rpc(...)`) cai em:

```
function ... is not unique
HINT: Could not choose a best candidate function.
```

Como o cliente usa `void supabase.rpc(...).then(() => {}, () => {})` (fire-and-forget
com erro engolido em `publicFunnelTelemetry.ts:88-92`), **nenhum evento é gravado
e nenhum erro vaza para console**. Esse é o único motivo de `audit_log` com
`resource_type='public_funnel'` ter **0 linhas em 90 dias**.

Evidência:

```
oid    | args
121929 | _action, _category, ..., _pathname              (8)
122045 | _action, _category, ..., _pathname, _sponsor_ref (9)
```

Smoke test local (psql, postgres role) reproduz o erro
`function ... is not unique` — não é problema de RLS/permissão/bot filter/dedup.

## Wiring atual (verificado em código)

| Hook                  | Local                        | Status no código |
|-----------------------|------------------------------|------------------|
| `trackPublicSearch`   | SearchPage.tsx:331           | ✅ Montado       |
| `trackCategoryView`   | CategoryPage.tsx:71          | ✅ Montado       |
| `trackCategoryView`   | CategoryCityPage.tsx:63      | ✅ Montado       |
| `trackCityView`       | CityPage.tsx:58              | ✅ Montado       |
| `trackCityView`       | CityDetailPage.tsx:65        | ✅ Montado       |
| `trackProfileView`    | ProviderProfile.tsx:622      | ✅ Montado       |
| `trackProfileView`    | CompanyProfile.tsx:404       | ✅ Montado       |
| `trackLeadSubmit`     | ProviderProfile.tsx:1253     | ✅ Montado       |
| `trackLeadSubmit`     | CompanyProfile.tsx:477       | ✅ Montado       |
| `trackInternalLinkClick` | —                         | ❌ Não existe    |

Todos via `import('@/lib/publicFunnelTelemetry')` lazy. Mount real em `useEffect`
com deps válidas. Pathname derivado de `window.location` (válido). Dedup
client-side 10min em sessionStorage. Sem Suspense bloqueando.

## Outros achados (secundários — só dão problema DEPOIS de resolver o overload)

1. **Bot filter no servidor é agressivo**: regex bloqueia `facebookexternalhit`
   e `whatsapp` (legítimos para preview de link), mas isso é correto para
   funil (eles não convertem). Não destrói tráfego humano real.
2. **Dedup server-side de 10min por `(action, category, city, term,
   resource_id, pathname, user_id)`** — coerente com client-side. Sem colisão.
3. **`details->>'pathname'`**: o RPC grava o pathname inteiro
   (`pathname + search`), então rotas como `/buscar?categoria=x&cidade=y` viram
   chaves diferentes de `/buscar` — bom para análise, mas infla cardinalidade
   no dedup. Não é bloqueador.
4. **RLS de `audit_log`**: SELECT só admin, INSERT só admin — RPC é
   `SECURITY DEFINER`, então isso está correto.
5. **`fire()` engole TUDO** com `.then(()=>{},()=>{})`. Sem o overload
   ambíguo, ainda seria difícil detectar regressão futura. Sprint A precisa
   de DEV-only `window.__FUNNEL_DEBUG` para tornar falhas visíveis localmente.
6. **`internal_link_click` ainda não está na whitelist do RPC nem implementado
   no cliente** — pré-requisito da Etapa 2.

## TOP 10 motivos concretos de `public_funnel=0`

1. **Overload ambíguo da RPC (causa #1, 100% do volume perdido)** ← bloqueador único
2. Erro silenciado no `.then(()=>{},()=>{})` esconde o sintoma
3. Sem DEV-only telemetry para detectar regressões futuras
4. Sem `internal_link_click` na whitelist
5. Sem instrumentação em `SeoRelatedLinks` / breadcrumbs / related providers
6. Bot filter bloqueia `whatsapp`/`facebookexternalhit` (correto, mas reduz contagem)
7. Pathname com query string infla cardinalidade do dedup (não bloqueia)
8. Atribuição sponsor só funciona em `profile_view`/`lead_submit` (correto)
9. Sem painel admin que mostre `emitted vs persisted` (cego ao vazamento)
10. Sem teste de smoke contra a RPC real

## Decisão para Sprint A

**Etapa 1 (auditoria) — concluída.**

Antes de tocar em qualquer wiring novo (Etapas 2–9), a Sprint A precisa
**resolver o overload ambíguo** — `DROP FUNCTION` da assinatura de 8 args e
manter só a de 9 (que já aceita `_sponsor_ref` com default NULL). Sem isso
nenhuma das etapas seguintes consegue gerar evidência real.

## Próximo passo proposto ao usuário

1. Migration: `DROP FUNCTION public.record_public_funnel_event(text,text,text,text,integer,text,text,text);`
2. Smoke test (re-rodar `trackCategoryView` artificial e ver linha no `audit_log`).
3. Só depois prosseguir com Etapas 2–9 (internal link tracking, debug DEV,
   painel admin, hardening do bot filter, testes).
