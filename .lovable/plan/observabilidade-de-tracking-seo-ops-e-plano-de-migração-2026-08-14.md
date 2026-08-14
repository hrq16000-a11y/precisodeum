# Observabilidade de Tracking, SEO Ops e Plano de Migração

Sua solicitação junta 9 frentes. Abaixo o que proponho construir, em ordem de valor, mais o plano de migração pedido. Também há 1 achado de segurança ativo (sponsors expondo CNPJ/e-mail/telefone para anônimos) que corrijo junto.

## 1. Telemetria dos RPCs de tracking (anti "silenciosamente quebrado")

- Wrapper único `src/lib/tracking/safeRpc.ts` usado por `searchIntent.ts`, `publicFunnelTelemetry.ts`, `AdSlot.tsx`, `SponsorAdSlot.tsx`, `usePinnedSponsor.ts`, `useSponsors.ts`.
- Captura sucesso/erro, código Postgres (42501 e outros), latência; envia com **amostragem** (100% dos erros, 5% dos sucessos) para uma nova tabela `tracking_rpc_health` (RLS: insert via RPC `record_tracking_rpc_health`, leitura só admin).
- Nunca quebra a UI: falha do wrapper é engolida.

## 2. Chave de idempotência / dedupe

- Helper `trackingDedupeKey(type, payloadIds, bucketMs)` — hash estável por (tipo de evento, alvo, sessão, janela de tempo).
- Janelas: impressão 30 min, clique 5 min, search intent 10 min, funnel 10 min.
- Dedupe em duas camadas: client (sessionStorage + Set em memória, imune a re-render/StrictMode) e servidor (coluna `dedupe_key` + índice único parcial nas tabelas de telemetria; RPCs passam a `ON CONFLICT DO NOTHING`).

## 3. Painel admin de saúde do tracking

- Nova rota `/admin/tracking-health`: taxa de sucesso/erro por RPC nas últimas 24h/7d, breakdown por código de erro, série temporal, top rotas afetadas.
- Regra de alerta: se erro > 5% em 15 min ou qualquer 42501 → notificação admin (`notifications`) + Slack quando webhook existir.

## 4. Testes de CI

- Teste Deno/REST que chama as 3 RPCs como **anon** (chave publishable) e falha se retornar 42501.
- Teste SQL/asserção que `has_function_privilege('anon', ..., 'EXECUTE')` é verdadeiro para toda função SECURITY DEFINER da allowlist de tracking.
- Plugado no workflow existente `security-lints.yml` + `smoke-after-deploy.yml`.

## 5. Painel de métricas GSC em `/admin/seo`

- Últimos 7 dias: nº de submissões, tempo médio/p95 de resposta, taxa de falha, percentuais por sitemap e por partição, tendência dia a dia (dados de `gsc_audit_log`).

## 6. Drill-down de falhas do AdSense

- Clicar numa rota abre painel lateral com todas as ocorrências: código de erro, timestamp, mensagem e link direto para o Rich Results Test / URL Inspection daquela rota.

## 7. Exportação consolidada da auditoria

- Botão "Baixar relatório" (JSON e CSV) da última execução: verificações AdSense, canônicos/noindex, disponibilidade HTTP e resultados do GSC num único arquivo.

## 8. Alertas persistentes (GSC + AdSense)

- Regras configuráveis em `site_settings` (N execuções consecutivas com falha, severidade, canal).
- Severidades warning/critical → Slack e/ou e-mail (Resend). Depende de você conectar Resend e me dar o `GSC_ALERT_SLACK_WEBHOOK` — vou pedir o secret durante a execução e faço um envio de teste para confirmar.

## 9. Desativar consumo desnecessário

- Varredura de chamadas a IA/gateway e crons: desligo ou reduzo frequência do que não tem consumidor (cron de auditoria diária, jobs de snapshot sem painel). Listo cada item antes de desligar; nada é removido, só desativado por flag.

---

## Plano de migração Lovable Cloud → Supabase próprio

Importante: o backend **já é Supabase**. "Migrar" significa passar o projeto gerenciado pelo Lovable Cloud para uma conta Supabase sua. Não há reescrita de código; muda apenas de onde vêm as credenciais.

**7 processos, nesta ordem:**

1. **Inventário congelado** — dump de schema (tabelas, 400+ funções, RLS, grants, triggers, enums), lista de buckets, secrets e crons. Gera checksum.
2. **Provisionar projeto Supabase** na sua conta (mesma região) e aplicar o dump de schema. Validação: contagem de objetos e grants iguais ao inventário.
3. **Dados** — export/import por ordem de dependência de FK, com `session_replication_role` para triggers. Validação por contagem de linhas por tabela.
4. **Storage** — copiar buckets e objetos via pipeline de portabilidade que já existe (`export-user-ref-media.mjs` / `restore-bundle.mjs`), validação por checksum.
5. **Auth** — migrar `auth.users` (hashes preservados, sem reset de senha), reconfigurar provedores OAuth (Google) e URLs de redirect. É o passo com maior risco: exige janela curta de congelamento de cadastros.
6. **Edge functions + secrets** — redeploy das funções, recriar cada secret e os crons (`pg_cron`/`pg_net`).
7. **Cutover** — trocar as 3 variáveis de ambiente do frontend, rodar o smoke test pós-deploy, monitorar 24h com o painel de saúde. Rollback = reverter as variáveis.

**Riscos:** Auth (sessões ativas caem), secrets que só existem no Cloud (service role é regerado), e crons precisam ser recriados manualmente. **Zero conflito de código** — nenhum arquivo `src/` muda.

Recomendação: fazer os itens 1–9 acima primeiro (deixam o portal observável), e a migração como projeto separado depois, com data marcada.

---

## Ordem de execução proposta

Fase A (agora): itens 1, 2, 3, 4 + correção do achado de segurança dos sponsors.
Fase B: itens 5, 6, 7, 8.
Fase C: item 9 e, se você aprovar, a migração.
