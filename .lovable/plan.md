# Melhorias no Módulo de Vagas

Após auditoria completa dos 4 arquivos do módulo (Dashboard, Listagem pública, Detalhe, Admin), identifiquei **7 melhorias** concretas.

---

## 1. Vagas Expiradas — Auto-desativação

**Problema:** Vagas com `deadline` vencido continuam aparecendo como "Ativa" na listagem pública. Não há filtro por prazo.

**Ação:** Adicionar filtro `deadline >= today OR deadline IS NULL` na query pública do `JobsPage.tsx`. Na listagem do dashboard, exibir badge "Expirada" em vermelho para vagas com prazo vencido.

## 2. Busca por Descrição e Categoria (Listagem Pública)

**Problema:** A busca pública (`JobsPage`) filtra apenas por `title` (`ilike`). Se o usuário buscar "eletricista" e o título for "Técnico Residencial", não encontra.

**Ação:** Expandir a busca para incluir `description` e o nome da categoria usando `or()` do Supabase. Isso melhora drasticamente a relevância dos resultados.

## 3. Contador de Visualizações por Vaga

**Problema:** Não há métricas de visualização. O anunciante não sabe se sua vaga está sendo vista.

**Ação:**

- Adicionar coluna `view_count integer default 0` na tabela `jobs`
- Incrementar via RPC (`increment_job_view`) chamado no `JobDetailPage`
- Exibir o contador no card do dashboard e na página de detalhe

## 4. Compartilhamento Social (JobDetailPage)

**Problema:** A página de detalhe tem apenas "Copiar link". Faltam botões de compartilhar no WhatsApp, Facebook, LinkedIn.

**Ação:** Adicionar botões de compartilhamento social na sidebar do `JobDetailPage` com links nativos (WhatsApp API, Facebook sharer, LinkedIn share).

## 5. Notificação ao Anunciante (Aprovação/Rejeição)

**Problema:** Quando o admin aprova ou rejeita uma vaga, o anunciante não é notificado. Só descobre ao acessar o dashboard.

**Ação:** No `AdminJobsPage`, ao aprovar/rejeitar, inserir um registro na tabela `notifications` para o `user_id` da vaga, com mensagem contextual.

## 6. Filtros no Admin — Cidade e Categoria

**Problema:** O painel admin filtra apenas por `approval_status` e texto livre. Não há filtro por cidade ou categoria.

**Ação:** Adicionar selects de filtro por cidade e categoria no `AdminJobsPage`, usando os dados já disponíveis na query.

## 7. Edição Completa no Admin

**Problema:** O dialog de edição no admin só permite alterar título, descrição, status e aprovação. Campos como cidade, salário, WhatsApp, categoria não são editáveis.

**Ação:** Expandir o formulário de edição do admin para incluir todos os campos relevantes (cidade, estado, categoria, salário, WhatsApp, tipo de contrato, modelo de trabalho).

---

## Arquivos Modificados


| Arquivo                           | Alterações                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/pages/JobsPage.tsx`          | Busca expandida (descrição + categoria); filtro de deadline                                |
| `src/pages/JobDetailPage.tsx`     | Botões de compartilhamento social; chamada de view_count                                   |
| `src/pages/DashboardJobsPage.tsx` | Badge "Expirada"; exibir view_count no card                                                |
| `src/pages/AdminJobsPage.tsx`     | Filtros cidade/categoria; formulário de edição completo; notificação na aprovação/rejeição |
| **Migration SQL**                 | Coluna `view_count`; função RPC `increment_job_view`                                       |


## O que NÃO será alterado

- Schema blindado (`client.ts`, `types.ts`, `.env`)
- Parser de texto (`jobTextParser.ts`) — já funciona bem
- GeoEngine, SIL, Governance Engine
- RLS policies existentes

Permitir que o administrativo tenha gestão de criar Editar e excluir vagas.

&nbsp;