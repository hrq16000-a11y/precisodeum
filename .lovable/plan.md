
# Correção Mobile + Admin 100% Gerenciável — Módulo Vagas

## Problemas Identificados

1. **Dashboard Mobile quebrado**: Os botões "Importar CSV" e "Nova Vaga" ficam na mesma linha do título, comprimidos no celular. Os botões de ação por card (5 ícones lado a lado) não cabem no mobile.

2. **Admin sem controle total**: O admin pode criar/editar/excluir, mas faltam:
   - Ações em massa (aprovar/rejeitar) com notificação
   - Edição do `user_id` (reassociar vaga a outro usuário)
   - Toggle de status direto na listagem (ativar/desativar sem abrir modal)
   - Restaurar vagas excluídas (lixeira)
   - Visualização de quem criou a vaga (nome do usuário)

## Plano de Execução

### 1. Corrigir layout mobile — DashboardJobsPage

- Header: empilhar título + botões verticalmente no mobile (`flex-col sm:flex-row`)
- Botões: trocar "Importar CSV" para ícone-only no mobile
- Cards de vagas: empilhar ações abaixo do conteúdo no mobile ao invés de lado a lado
- Garantir que o botão "Nova Vaga" fique visível e clicável no celular

### 2. Admin com controle absoluto — AdminJobsPage

- Adicionar coluna "Criado por" com nome do usuário (join com `profiles`)
- Toggle rápido de status (ativo/inativo) direto na listagem sem modal
- Campo `user_id` no formulário de edição (select de usuários ou input UUID) para reassociar vagas
- Link para a lixeira de vagas (`/admin/lixeira?type=job`)
- Exibir resumo de stats no topo (total, ativas, pendentes, expiradas)

## Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/pages/DashboardJobsPage.tsx` | Layout responsivo mobile — header empilhado, cards com ações embaixo |
| `src/pages/AdminJobsPage.tsx` | Stats cards, toggle status, campo user_id, nome do criador, link lixeira |

## O que NÃO será alterado
- Schema de tabelas (sem migrations)
- RLS policies existentes
- `client.ts`, `types.ts`, `.env`
