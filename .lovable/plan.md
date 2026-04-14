

## Plano: Reformulação Completa do Formulário "Novo Serviço"

Transformar o formulário de cadastro de serviço de uma experiência "e-commerce" para um fluxo profissional mobile-first, com novos campos no banco de dados, sincronização admin e UX otimizada.

---

### Etapa 1 — Migração de Banco de Dados

Adicionar 3 novas colunas na tabela `services`:

| Coluna | Tipo | Default |
|--------|------|---------|
| `is_emergency` | boolean | false |
| `service_radius` | text | 'city' |
| `seo_tags` | text[] | '{}' |

Valores de `service_radius`: `'local'`, `'city'`, `'metro'`.

---

### Etapa 2 — Reformulação do Formulário (DashboardServicesPage.tsx)

**Placeholders contextuais:**
- Titulo: "Ex: Instalação de Ar Condicionado"
- Descrição: "Descreva seu serviço, diferenciais e o que está incluso..."

**Cidade com autocomplete + geolocalização:**
- Substituir input de texto por Combobox pesquisável (usando a base IBGE existente em `citiesIndex.ts`)
- Auto-detecção via `useGeoCity` no mount; exibir label "📍 Localização detectada" com opção de limpar

**Novos campos profissionais:**
- Raio de atendimento: Select com 3 opções (No local / Toda a cidade / Região Metropolitana)
- Toggle "Atendimento 24h / Emergências" com destaque visual laranja
- Campo de Tags/Palavras-chave com input tipo chip (ex: #reformas, #elétrica)

**Agrupamento visual em seções:**
- "Informações Básicas" (título, descrição, preço, categoria)
- "Localização & Atendimento" (cidade, raio, emergência)
- "Contato & Mídia" (WhatsApp, foto, redes sociais, tags)
- Separadores visuais com títulos de seção

**Fix de botões no mobile:**
- Botões "Cancelar" e "Publicar" em barra sticky no fundo do dialog, acima da nav inferior
- Padding-bottom seguro (pb-20) + sombra superior
- Scrollbar estilizada com track laranja fino

---

### Etapa 3 — Payload e Persistência

- Incluir `is_emergency`, `service_radius` e `seo_tags` no payload de save/update
- Garantir que o form de edição carregue os valores existentes

---

### Etapa 4 — Admin Sincronizado (ServiceEditDialog.tsx)

- Adicionar os 3 novos campos (emergency toggle, radius select, tags) ao diálogo de edição admin
- Garantir que o admin pode moderar/editar esses campos
- Incluir os novos campos no payload de update do admin

---

### Etapa 5 — Busca por Filtros (useProviders)

- Adicionar suporte a filtro `is_emergency = true` na busca pública
- `service_radius` e `seo_tags` serão pesquisáveis no Deep Search existente

---

### Detalhes Técnicos

**Arquivos modificados:**
- `supabase/migrations/` — Nova migração SQL (3 colunas)
- `src/pages/DashboardServicesPage.tsx` — Reformulação completa do dialog
- `src/components/admin/ServiceEditDialog.tsx` — Novos campos admin
- `src/hooks/useProviders.tsx` — Filtro de emergência no matching

**Dependências existentes reutilizadas:**
- `useGeoCity` para auto-detecção de localização
- `citiesIndex.ts` / base IBGE para autocomplete de cidades
- `SmartCategoryPicker` mantido como está

