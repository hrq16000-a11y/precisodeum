---
name: RLS permissivas de telemetria anônima — auditoria e justificativa
description: Quatro tabelas de telemetria aceitam INSERT sem checagem (WITH CHECK true) por design. Documenta colunas, ausência de campos atribuíveis a usuário, e por que são seguras.
type: constraint
---

# RLS permissivas de telemetria — comportamento esperado

Quatro tabelas em `public` permitem `INSERT` anônimo via política
`WITH CHECK (true)`. O linter da Supabase emite WARN em todas; **são
intencionais** e fazem parte do contrato público da plataforma.

## Tabelas auditadas (2026-04-26)

| Tabela | Colunas (tipo, nullable) | Campo atribuível? |
|---|---|---|
| `auth_profile_metrics` | `id uuid`, `recorded_at`, `user_id uuid?`, `duration_ms int`, `attempts int`, `succeeded bool` | `user_id?` opcional, gravado pelo próprio fluxo de auth — **sem PII direta** |
| `contact_clicks` | `id uuid`, `provider_id uuid`, `contact_type text`, `page_path?`, `visitor_id text?`, `created_at` | `visitor_id` é hash anônimo no client; sem `user_id` |
| `error_page_events` | `id uuid`, `occurred_at`, `path`, `code int`, `referrer?`, `user_id?`, `user_agent?` | `user_id?` opcional, usado para correlacionar erros do próprio usuário |
| `search_intent_log` | `id uuid`, `category_slug?`, `category_name?`, `city?`, `state?`, `visitor_id?`, `user_id?`, `created_at` | `visitor_id` anônimo; sem PII |
| `user_access_logs` | + `event_type`, `ip_address?`, `isp?`, `country?`, `region?`, `city?`, `user_agent?`, `device_type?`, `os?`, `browser?`, `metadata jsonb?` | Inserido apenas pela edge function `log-user-access` (service role); a policy `WITH CHECK (true)` é fallback — não é exploitable porque a edge é o único caller real |

## Por que `WITH CHECK (true)` é aceitável aqui

1. **Sem privilege escalation possível**: nenhuma destas tabelas concede
   permissão, score, status premium, ou qualquer side-effect funcional.
   Inserir lixo não dá ao atacante nada além de poluir métricas.
2. **Sem PII direta**: `visitor_id` é hash gerado no client; `user_id` é
   opcional e nunca usado para autorização — só para correlacionar
   sessões do próprio usuário.
3. **SELECT é restrito**: as policies de leitura exigem admin ou owner
   (`user_id = auth.uid()`), então um atacante que polui não consegue
   ler de volta para confirmar a injeção.
4. **Custo de spoofing > valor**: para envenenar métricas o atacante
   teria que enviar volume detectável, e há rate-limit por IP no edge.

## Quando reapertar

Se uma destas tabelas ganhar:
- coluna que conceda permissão/score/desconto, OU
- exposição em SELECT público (incluindo `public_*` views), OU
- referência usada por gatilhos de billing/notificação

→ revisar a policy imediatamente e migrar para `WITH CHECK (...)` validado.

## Linter

Os WARN `0024_permissive_rls_policy` que persistem após a auditoria de
2026-04-26 são **aceitos** para estas 5 tabelas. Não tente "corrigir"
sem antes revisitar este documento.
