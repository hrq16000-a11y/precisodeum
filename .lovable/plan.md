

# Consolidação e Melhorias da Gestão Admin

## Status Atual

As 3 funcionalidades listadas **já estão implementadas**:
- `/admin/usuarios` tem filtro por status de aprovação + ações de aprovar/rejeitar prestadores
- `/admin/prestadores` tem stats cards, edição completa e checklist de verificação

**Problema**: As duas páginas têm funcionalidades sobrepostas de moderação, mas `/admin/prestadores` oferece recursos especializados que `/admin/usuarios` não tem (cards visuais, checklist de verificação, edição profunda, geocodificação).

## Proposta: Consolidar sem perder recursos

Em vez de remover `/admin/prestadores`, a proposta é **diferenciar claramente o papel de cada página**:

### 1. Limpar moderação duplicada de `/admin/usuarios`

Na tabela de usuários, **remover os botões individuais de aprovar/rejeitar prestador** e substituir por um **link direto** para `/admin/prestadores` quando o usuário é do tipo `provider`. Isso evita confusão sobre onde moderar.

Manter apenas:
- Filtro por status de aprovação (para visibilidade)
- Badge de status do prestador na tabela
- Link "Gerenciar" que leva ao `/admin/prestadores` filtrado

### 2. Melhorias em `/admin/prestadores`

- **Aba de detalhes expandível**: Ao clicar no card, expandir mostrando o checklist de verificação completo (não compact) + dados do prestador
- **Filtro por categoria**: Adicionar dropdown de categoria ao lado dos filtros existentes
- **Filtro por cidade/estado**: Permitir filtrar prestadores por localização
- **Indicador de "último acesso"**: Mostrar quando o prestador acessou a plataforma pela última vez

### 3. Melhorias gerais de UX

- **Contadores no menu lateral**: Mostrar badge com contagem de pendentes no link do menu para `/admin/prestadores`
- **Exportação CSV**: Adicionar botão de exportar na página de prestadores (já existe na de usuários)

## Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/pages/AdminUsersPage.tsx` | Remover botões aprovar/rejeitar, adicionar link para /admin/prestadores |
| `src/components/admin/UserTable.tsx` | Substituir ações de moderação por link "Gerenciar prestador" |
| `src/pages/AdminProvidersPage.tsx` | Adicionar filtros de categoria e cidade, card expandível, exportação CSV |

Sem mudanças de banco de dados.

