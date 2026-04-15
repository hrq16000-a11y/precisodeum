# Plan: Refatorar Central de Usuários e Perfil Público

## Resumo

Refatorar a label de tipo no perfil público (Prestador/Empresa, nunca Administrador), adicionar abas de navegação por tipo no admin, filtros de ordenação, eliminar emojis remanescentes no admin, e adicionar realtime sync para estatísticas.

---

## 1. Perfil Público — Labels inteligentes (`ProviderProfile.tsx`)

**Onde:** Linhas ~1052-1056 (badge `accTypeInfo`)

- Substituir a exibição direta de `provider.accTypeInfo.name` por lógica condicional:
  - Se `provider.cnpj` preenchido: mostrar **"Empresa"** com ícone `Building2`
  - Se provider sem CNPJ: mostrar **"Prestador"** com ícone `Wrench`
  - **Nunca** exibir "Administrador" — ocultar o badge se `accTypeInfo.name` contiver "Admin"
- Remover a dependência do `accTypeInfo.name` para a label pública

## 2. Remover o badge `GamificationLevelBadge` da exibição pública se for Admin

**Onde:** Linhas ~1060-1068

- Adicionar check: não renderizar badges de nível para admins (verificar via `provider.levelInfo`)

## 3. Admin — Abas de navegação por tipo (`AdminUsersPage.tsx`)

**Onde:** Substituir o tab simples "Usuários | Métricas" (linhas ~614-618) por:

```
Clientes | Prestadores | Empresas | Agências | Patrocinadores | Staff | Métricas
```

- **Clientes**: `profile_type === 'client'` e sem CNPJ
- **Prestadores**: `profile_type === 'provider'` e sem CNPJ
- **Empresas**: Qualquer profile com `cnpj` preenchido
- **Agências**: `profile_type === 'rh'`
- **Patrocinadores**: IDs presentes em `sponsor_contacts`
- **Staff**: IDs presentes em `user_roles` com role `admin`
- Cada aba filtra automaticamente a lista

## 4. Filtros de ordenação

**Onde:** `UserFilters.tsx` — adicionar novo `<Select>` de ordenação

- **Mais recentes** (default): `created_at DESC`
- **Mais antigos**: `created_at ASC`
- **Melhor Ranking**: `engagement_points DESC`
- Propagar `sortBy` para `AdminUsersPage` e aplicar no `useMemo` do `filtered`

## 5. Eliminar emojis no admin

**Arquivos afetados:**

- `AdminUsersPage.tsx` linhas 655-684: substituir `✅`, `🔴`, `👤`, `🔧`, `🏢`, `✕` por ícones Lucide (`CheckCircle`, `XCircle`, `User`, `Wrench`, `Building2`, `X`)
- `UserFilters.tsx` linhas 15-16: substituir `⏸️ Suspenso` e `🚫 Banido` por texto puro ou ícones Lucide

## 6. Realtime sync para estatísticas do perfil público

**Onde:** `ProviderProfile.tsx` — após o fetch inicial

- Adicionar `supabase.channel()` listening em:
  - `providers` (filtrado por `id = provider.id`) para `services_count`, `portfolio_photo_count`, `years_experience`
  - `reviews` (filtrado por `provider_id = provider.id`) para atualizar `reviews` e `review_count`
- Atualizar state local via `setProvider(prev => ({...prev, ...changes}))` sem reload
- Cleanup do channel no return do useEffect

## 7. Buscar dados de patrocinadores para aba Staff/Patrocinadores

**Onde:** `AdminUsersPage.tsx` no `fetchProfiles`

- Adicionar query `supabase.from('sponsor_contacts').select('user_id')` para popular `sponsorUserIds: Set<string>`
- Usar no filtro da aba "Patrocinadores"

---

## Arquivos modificados


| Arquivo                                | Mudança                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| `src/pages/ProviderProfile.tsx`        | Labels Prestador/Empresa, ocultar Admin, realtime channel   |
| `src/pages/AdminUsersPage.tsx`         | 7 abas por tipo, ordenação, eliminar emojis, fetch sponsors |
| `src/components/admin/UserFilters.tsx` | Adicionar sort select, remover emojis                       |


## Segurança

Nenhuma mudança de schema ou RLS necessária. Apenas lógica de UI e queries de leitura.

&nbsp;

&nbsp;

"Execute a implementação completa dos módulos de gestão para a plataforma precisodeum.com.br, focando em uma vitrine de contato direto e sincronização via Supabase Realtime. Siga as especificações técnicas abaixo:

1. Reestruturação de Perfil e Lógica de Identificação:

Automated Labels: Implemente lógica para que perfis com user_type = 'professional' sejam exibidos como 'Prestador'. Se o campo cnpj estiver preenchido, altere automaticamente para 'Empresa'.

Admin Stealth: Garanta que usuários com is_admin: true não apareçam em nenhuma listagem pública, mapa ou ranking.

Estatísticas Sincronizadas: Configure os componentes de perfil para ouvir mudanças via supabase.channel(). As contagens de 'Serviços Prestados', 'Fotos no Portfólio' e 'Avaliações' devem atualizar na UI assim que os dados mudarem no banco, sem recarregar a página.

2. Painel Administrativo Segmentado (Admin Dashboard):

Crie uma área de gestão com abas (Shadcn UI Tabs):

Clientes: Listagem de usuários finais.

Prestadores: Listagem de profissionais (ordenável por 'Últimos Cadastrados', 'Maior Ranking' e 'Cidade').

Empresas: Somente perfis com CNPJ.

Patrocinadores: Somente usuários com is_sponsor: true. Inclua campos de 'Data de Expiração' e 'Status do Pagamento' (apenas informativo).

Staff: Gestão de administradores.

Ações de Gestão: Adicione botões para 'Ajuste Manual de Ranking' e 'Atribuir Bônus de Qualidade' (campo points no banco).

Log de Atividades: Crie uma tabela de logs que registre last_login e profile_updates para auditoria do admin.

3. Módulo de SEO e Comercial Gerenciável:

Editor de Metadados: Crie uma interface onde eu possa selecionar uma 'Categoria' e 'Cidade' e editar manualmente o Meta Title e Meta Description daquela página específica.

Gestão de Vitrines: Interface para selecionar quais IDs de profissionais aparecerão no componente de 'Destaques' da Home e por quanto tempo.

Dashboard de Crescimento: Implemente gráficos (Recharts) mostrando novos cadastros por dia e volume de leads (pedidos de orçamento) gerados.

4. Fluxo de Contato e Isenção de Responsabilidade:

Disclaimer de Contato: No botão 'Ver Telefone' ou 'WhatsApp', implemente um modal obrigatório: 'O precisodeum.com.br é apenas uma vitrine. Não intermediamos pagamentos nem garantimos serviços. A negociação é 100% direta entre as partes.'

Gestão de Avisos: Crie um campo no admin para editar o texto deste disclaimer e do banner de rodapé globalmente.

5. Recursos Técnicos Adicionais:

Gestão de Leads: Interface para listar pedidos de orçamento feitos, mostrando quem respondeu e permitindo ao admin marcar o status (Aberto/Concluído) para fins estatísticos.

Moderação: Filtro de denúncias para avaliações e fotos de portfólio.

Mapa de Calor: Integre os dados de geolocalização (PostGIS) em um mapa administrativo para visualizar a densidade de prestadores por bairro/cidade."

Instrução Adicional para você (Henrique):

Ao colar esse prompt, a Lovable pode perguntar sobre as tabelas. Responda:

"Pode criar as colunas e tabelas necessárias no Supabase via SQL, garantindo que o RLS (Row Level Security) permita que apenas o Admin edite os campos de Ranking, Status de Patrocinador e Metadados de SEO."