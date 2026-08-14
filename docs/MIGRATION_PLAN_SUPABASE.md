# Plano de migração 100% para Supabase próprio

> **Este documento é somente planejamento.** Nenhuma migration é executada por ele.
> Executar apenas na janela de cutover combinada, seguindo a ordem abaixo.

O backend já roda em Postgres/Supabase gerenciado pelo Lovable Cloud. "Migrar 100%"
significa transferir schema, dados, storage, auth, edge functions, secrets e crons
para um projeto Supabase da sua conta, **sem alterar código-fonte** — mudam apenas
as três variáveis públicas do frontend e os secrets do backend.

---

## 1. Estimativa de esforço

| Fase | Processos | Duração estimada | Downtime |
| --- | --- | --- | --- |
| 0 · Pré-voo e inventário | 5 | 2–3 h | nenhum |
| 1 · Backup completo | 6 | 1–2 h | nenhum |
| 2 · Provisionar destino + schema | 4 | 1 h | nenhum |
| 3 · Carga de dados | 5 | 1–3 h (depende do volume) | nenhum (cópia a frio) |
| 4 · Storage | 3 | 1–2 h | nenhum |
| 5 · Auth | 4 | 30–60 min | **15–30 min (congelamento de cadastros)** |
| 6 · Edge functions, secrets e crons | 5 | 1–2 h | nenhum |
| 7 · Cutover e validação | 6 | 1 h + 24 h de observação | 5–10 min |
| **Total** | **38 processos** | **8–14 h úteis** | **~20–40 min** |

---

## 2. Fase 0 · Pré-voo e inventário (5 processos)

1. Congelar merges na branch de produção e anotar o commit exato (`git rev-parse HEAD`).
2. Inventariar objetos do banco: tabelas, views, enums, funções (400+), triggers,
   policies RLS, grants por role, índices, extensões (`pg_cron`, `pg_net`, `postgis`).
3. Inventariar buckets de storage: `avatars`, `portfolio`, `service-images`,
   `sponsors`, `sponsor_assets` — anotando público/privado e policies.
4. Inventariar secrets usados pelas edge functions e crons agendados (`cron.job`).
5. Gerar checksum do inventário e arquivar como artefato imutável do release.

**Critério de saída:** arquivo de inventário versionado + checksum.

## 3. Fase 1 · Backup completo (6 processos)

1. Dump de **schema** (`--schema-only`) incluindo `public`, tipos e funções.
2. Dump de **dados** (`--data-only --disable-triggers`) por ordem de dependência de FK.
3. Dump separado de `auth.users` (hashes preservados) e `auth.identities`.
4. Export de storage por `user_ref` com o pipeline existente:
   `npm run portability:export-media -- ./backup/portability-user-ref-media.zip`.
5. Export dos metadados operacionais: `site_settings`, `tier_rules`, `sponsor_plans`,
   `governance_rules`, `gamification_levels` (linhas de configuração, não de usuário).
6. Verificar integridade: contagem de linhas por tabela + SHA-256 de cada artefato.

**Critério de saída:** `files_failed = 0`, `active_media_without_user_ref = 0`.

## 4. Fase 2 · Provisionar destino e schema (4 processos)

1. Criar projeto Supabase na sua conta, **mesma região** do atual (latência e LGPD).
2. Habilitar extensões antes do restore (`pg_cron`, `pg_net`, `postgis`, `pgcrypto`).
3. Aplicar dump de schema.
4. Conferir paridade: contagem de tabelas, funções, policies e **grants por role**
   (`anon`, `authenticated`, `service_role`) — divergência de grant é a falha mais
   comum e aparece como erro 42501 no front.

## 5. Fase 3 · Carga de dados (5 processos)

1. `SET session_replication_role = replica` para desligar triggers durante a carga.
2. Importar tabelas de referência (`states`, `cities`, `categories`, `account_types`,
   `gamification_levels`, `tier_rules`).
3. Importar tabelas de usuário (`profiles`, `providers`, `services`, `leads`, …).
4. Importar tabelas de telemetria/log (podem ser truncadas se quiser começar limpo).
5. Restaurar `session_replication_role = origin` e validar contagem linha a linha.

## 6. Fase 4 · Storage (3 processos)

1. Criar buckets com as mesmas políticas de visibilidade.
2. `npm run portability:restore-media -- ./backup/portability-user-ref-media.zip`.
3. `npm run portability:validate-restore` — aprovado só com checksums idênticos.

## 7. Fase 5 · Auth (4 processos) — **maior risco**

1. Anunciar e congelar cadastros/login (banner + flag em `site_settings`).
2. Importar `auth.users` e `auth.identities` preservando os hashes (sem reset de senha).
3. Reconfigurar provedores sociais (Google) e as URLs de redirect/site URL.
4. Testar: signup novo, login e-mail/senha, login Google, recuperação de senha.

> Sessões ativas caem no cutover (o JWT é assinado por outro projeto). É esperado:
> usuários apenas refazem login.

## 8. Fase 6 · Edge functions, secrets e crons (5 processos)

1. Redeploy de todas as funções em `supabase/functions`.
2. Recriar cada secret (o `SERVICE_ROLE_KEY` é **novo** — nunca reutilizar o antigo).
3. Recriar jobs de `pg_cron` (auditoria SEO, billing de patrocinadores, follow-up de
   leads, kill switch de experimentos, integridade diária).
4. Reapontar webhooks externos (Resend, Slack, Google Search Console).
5. Rodar `supabase/functions/health-check` no destino e conferir 100% verde.

## 9. Fase 7 · Cutover e validação (6 processos)

1. Atualizar `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
2. Deploy do frontend e purge de CDN/Service Worker (bump de `APP_VERSION`).
3. Rodar o smoke test pós-deploy (`.github/workflows/smoke-after-deploy.yml`).
4. Rodar `scripts/verify-anon-tracking-grants.mjs` — falha aqui = 42501 em produção.
5. Monitorar 24 h: `/admin/tracking-health`, `/status`, `/admin/seo/web-vitals`.
6. Manter o projeto de origem **em modo leitura por 30 dias** como rollback.

---

## 10. Checklist de compatibilidade

- [ ] Extensões habilitadas antes do restore (`postgis` quebra triggers de geo).
- [ ] `search_path` das funções `SECURITY DEFINER` preservado (`public, extensions`).
- [ ] GRANTs para `anon` nas RPCs de tracking (`track_sponsor_metric`,
      `log_search_intent`, `record_public_funnel_event`).
- [ ] Revokes de coluna de PII (`providers.cpf/cnpj/phone/birth_date`,
      `sponsors.cnpj/email`, `jobs.contact_phone/whatsapp/contact_name`) reaplicados.
- [ ] Índices únicos parciais de dedupe (`tracking_event_dedupe`, `notifications`).
- [ ] Colunas geradas (`notifications.fts_pt`) recriadas com o mesmo dicionário.
- [ ] Buckets privados continuam privados (`sponsor_assets`).
- [ ] Realtime habilitado nas tabelas que a UI escuta (`leads`, `lead_interactions`,
      `chat_messages`, `notifications`).
- [ ] `cron.job` recriado com os mesmos horários UTC.
- [ ] Nenhum arquivo em `src/` alterado (diff deve ser vazio fora de env/secrets).

## 11. Riscos e mitigação

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Grants ausentes após restore | 42501 no front, tracking morto | `verify-anon-tracking-grants.mjs` no pipeline |
| Hash de senha não migrado | Todos precisam resetar senha | Migrar `auth.users` via dump nativo, testar antes |
| Crons não recriados | Billing/SEO param em silêncio | Checklist da Fase 6 + `/status` |
| Storage parcial | Imagens quebradas | `validate-restore` com checksum obrigatório |
| Service role antigo em secret | Falha silenciosa em edge function | Rotacionar 100% dos secrets na Fase 6 |

## 12. Rollback

Reverter as três variáveis do frontend e redeployar. O projeto de origem permanece
intacto (somente leitura) durante 30 dias — a janela de rollback é de minutos,
desde que nenhuma escrita nova tenha ocorrido no destino.
