

# Melhorias Pendentes — Auditoria Completa

O scan de segurança + inspeção de código revelou **8 itens** para corrigir/aprimorar, organizados por prioridade.

---

## 1. CRÍTICO — Realtime Channel Authorization

**Problema:** Qualquer usuário autenticado pode se inscrever nos canais Realtime de outros usuários (notificações, chat). Não há RLS no `realtime.messages`.

**Solução:** Adicionar RLS policies no Realtime para restringir canais por `auth.uid()`. Na prática, filtrar no código frontend para garantir que as subscriptions usem o `user_id` correto, e documentar a limitação (Realtime RLS em `realtime.messages` não é diretamente configurável via migrations padrão — a mitigação principal é server-side filtering no channel topic).

---

## 2. WARN — Reviews públicas incluem pendentes/rejeitadas

**Problema:** A policy `Reviews are viewable by everyone` usa `USING (true)`, expondo reviews com `approval_status = 'pending'` e o campo `admin_note`.

**Solução:** Migração SQL:
```sql
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (approval_status = 'approved');
```

---

## 3. WARN — runtime_component_health sem restrição

**Problema:** Qualquer usuário autenticado pode inserir/sobrescrever registros de saúde de componentes.

**Solução:** Restringir INSERT e UPDATE a admins:
```sql
DROP POLICY IF EXISTS "Authenticated users can insert component health" ON public.runtime_component_health;
DROP POLICY IF EXISTS "Authenticated users can report component errors" ON public.runtime_component_health;
CREATE POLICY "Admins manage component health" ON public.runtime_component_health
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
```
Atualizar `runtimeStabilityEngine.ts` para fazer flush via edge function autenticada com service_role, em vez de client direto.

---

## 4. WARN — governance_changes_log INSERT sem validação

**Problema:** Qualquer usuário autenticado pode inserir log entries referenciando qualquer `rule_id`, poluindo o audit trail.

**Solução:** Restringir INSERT a admins:
```sql
DROP POLICY IF EXISTS "Users can insert own governance changes" ON public.governance_changes_log;
CREATE POLICY "Admins can insert governance changes" ON public.governance_changes_log
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
```

---

## 5. WARN — 4x RLS policies "always true"

**Problema:** Existem políticas com `USING (true)` ou `WITH CHECK (true)` em operações INSERT/UPDATE/DELETE.

**Solução:** Identificar as 4 tabelas afetadas e restringir ao owner (`auth.uid() = user_id`) ou admin. Será necessário consultar as policies exatas via query antes de gerar a migração.

---

## 6. UX — DashboardJobsPage: extração não limpa ao reabrir dialog

**Problema:** `extractionSummary` persiste entre aberturas do dialog. Se o usuário abre "Nova Vaga", extrai texto, fecha e reabre, os badges continuam visíveis.

**Solução:** Limpar `setExtractionSummary([])` dentro de `openNew()`.

---

## 7. UX — DashboardJobsPage: city dropdown overlay z-index

**Problema:** O backdrop invisível (`fixed inset-0 z-10`) para fechar o dropdown de cidades intercepta cliques em todo o dialog, causando UX confusa.

**Solução:** Usar `onBlur` no input ao invés de backdrop global, ou elevar o z-index do dropdown acima do backdrop.

---

## 8. CÓDIGO — Extension in Public schema

**Problema:** Extensões instaladas no schema `public` (warning do linter). Baixo risco mas boa prática mover.

**Solução:** Deixar como está (mover extensões pode quebrar dependências existentes). Apenas documentar.

---

## Plano de Execução

### Migração SQL (1 arquivo)
- Fix reviews SELECT policy (apenas approved)
- Fix runtime_component_health (admin only)
- Fix governance_changes_log (admin only)
- Investigar e corrigir as 4 policies "always true"

### Código
- `src/pages/DashboardJobsPage.tsx` — limpar extractionSummary no openNew, fix z-index dropdown
- `src/lib/runtimeStabilityEngine.ts` — ajustar para não depender de INSERT direto do client (graceful fallback se policy bloquear)

### O que NÃO será alterado
- `client.ts`, `types.ts`, `.env`
- Tabelas blindadas (schema)
- GeoEngine, SIL, Governance Engine (lógica core)

