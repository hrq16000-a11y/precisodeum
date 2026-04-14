## Plano: Refatoração "Menos é Mais" — Central Única de Usuários

...

> ​"O plano está aprovado. A arquitetura proposta é exatamente o que precisamos: limpa, modular e com dados reais.
>
> ​Para garantir a estabilidade do sistema e evitar quebra de código, vamos executar em etapas.
>
> ​**AÇÃO IMEDIATA:** Execute agora **APENAS a Fase 1 e a Fase 2**.
>
> 1. ​Reescreva a AdminUsersPage.tsx implementando as abas 'Usuários' e 'Métricas'.
> 2. ​Crie as lógicas de busca no banco para que os KPIs do topo da tela sejam 100% reais (Total, Novos 30d, Profissionais Ativos, Suspensos/Banidos). Remova qualquer número hardcoded.
> 3. ​Atualize o componente UserFilters.tsx para incluir os status 'suspended' e 'banned'.
> 4. ​Faça o redirecionamento/limpeza da AdminUsersCrmPage.tsx e atualize as rotas e o menu lateral (App.tsx, AdminLayout.tsx, AdminGroupNav.tsx).
>
> ​Concentre-se em entregar essa interface principal unificada e livre de erros. Não inicie a Fase 3 (quebra do UserDetailSheet) ainda. Me avise assim que as Fases 1 e 2 estiverem prontas e renderizando corretamente na tela, para que eu possa validar e autorizar a etapa final."

.....

Unificar a gestão de usuários em uma única tela (`AdminUsersPage`), eliminar duplicação, corrigir bugs e quebrar o componente monstro `UserDetailSheet`.

---

### Fase 1 — Unificar em Uma Tela Só

**AdminUsersPage.tsx** passa a ter 2 abas superiores:


| Aba          | Conteúdo                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Usuários** | Lista atual (filtros + tabela + bulk actions + paginação)                                                                                                           |
| **Métricas** | Gráficos reais migrados do CRM (Crescimento 30d, Distribuição por Tipo, Funil, Retenção 12m, Top Cidades) + KPIs reais + Exportações CSV/PDF + Notificação em massa |


**KPI Cards** (topo, visíveis em ambas abas): substituir `UserStatsCards` hardcoded por cards com dados reais:

- Total de Usuários
- Novos (últimos 30 dias)
- Profissionais Ativos (providers com status approved)
- Suspensos/Banidos (contagem real do banco)

**Eliminar**: `AdminUsersCrmPage.tsx` — redirecionar rota `/admin/crm-usuarios` para `/admin/usuarios` e remover a importação lazy.

---

### Fase 2 — Correções de Bugs e Limpeza

1. **UserFilters.tsx** — adicionar `suspended` e `banned` nas opções de status
2. **user_tags** — tabela existe no banco, manter funcionalidade de tags (migrar da CRM page para a nova aba Métricas/Segmentar ou manter no UserDetailSheet)
3. Remover trend hardcoded "+12%" do `UserStatsCards` (será substituído por dados reais)

---

### Fase 3 — Quebrar UserDetailSheet (1.472 linhas → ~6 arquivos)

Extrair subcomponentes para `src/components/admin/user-detail/`:


| Arquivo                     | Conteúdo (aba)                         |
| --------------------------- | -------------------------------------- |
| `UserDetailProfile.tsx`     | Perfil + edição + avatar + reset senha |
| `UserDetailProvider.tsx`    | Dados do negócio + edição do provider  |
| `UserDetailServices.tsx`    | Lista de serviços + imagens            |
| `UserDetailModeration.tsx`  | Suspensão, banimento, tags             |
| `UserDetailPermissions.tsx` | Admin/Moderador/Sponsor roles          |
| `UserDetailTimeline.tsx`    | Audit log timeline                     |


Abas mantidas: Profile, Negócio, Serviços, Fotos/Portfolio, Tags, Leads, Moderação, Permissões, Timeline.
Aba removida: **Página** (page settings) — raramente usada e pode ser acessada diretamente pelo provider.

O `UserDetailSheet.tsx` passa a ser um orquestrador leve (~150 linhas) que importa os subcomponentes.

---

### Arquivos Modificados


| Arquivo                                    | Ação                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `src/pages/AdminUsersPage.tsx`             | Reescrever com abas (Usuários + Métricas), KPIs reais, gráficos do CRM |
| `src/pages/AdminUsersCrmPage.tsx`          | Esvaziar — redirect para `/admin/usuarios`                             |
| `src/components/admin/UserStatsCards.tsx`  | Remover (inline KPIs reais no AdminUsersPage)                          |
| `src/components/admin/UserFilters.tsx`     | Adicionar suspended/banned nos filtros                                 |
| `src/components/admin/UserDetailSheet.tsx` | Refatorar para orquestrador leve                                       |
| `src/components/admin/user-detail/*.tsx`   | 6 novos subcomponentes extraídos                                       |
| `src/App.tsx`                              | Redirecionar rota `/admin/crm-usuarios`                                |
| `src/components/AdminLayout.tsx`           | Remover link CRM Usuários da sidebar                                   |
| `src/components/admin/AdminGroupNav.tsx`   | Remover link CRM Usuários                                              |
