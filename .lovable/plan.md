

## Plano: Redesign da Homepage + Sistema de Ads + Contador no Dashboard

### Visao Geral

Redesenhar a homepage no estilo Triider (hero limpo, categorias com icones, layout moderno) sem alterar nenhuma logica de negocio. Adicionar sistema de patrocinadores/ads gerenciavel pelo admin. Adicionar contador de servicos no dashboard.

---

### 1. Nova tabela: `sponsors` (banners/patrocinadores)

```sql
CREATE TABLE public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text,
  link_url text,
  position text NOT NULL DEFAULT 'banner', -- 'banner', 'card', 'featured'
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

-- Todos podem ver sponsors ativos
CREATE POLICY "Sponsors viewable by everyone" ON public.sponsors
  FOR SELECT TO public USING (true);

-- Admin CRUD
CREATE POLICY "Admins can insert sponsors" ON public.sponsors
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update sponsors" ON public.sponsors
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete sponsors" ON public.sponsors
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
```

### 2. Redesign da Homepage (`src/pages/Index.tsx`)

Nova estrutura de secoes, nesta ordem:

```text
+------------------------------------------+
| HEADER (existente, sem mudancas)         |
+------------------------------------------+
| HERO - Fundo limpo branco/gradiente      |
|   H1: "Encontre profissionais para       |
|        qualquer servico"                  |
|   SearchBar (componente existente)        |
|   Subtexto: "Cadastre seus servicos..."  |
+------------------------------------------+
| CATEGORIAS POPULARES                     |
|   Grid 2x3 mobile / 6 cols desktop      |
|   Cards com icone + nome                 |
|   Link: /categoria/{slug}               |
+------------------------------------------+
| PROFISSIONAIS EM DESTAQUE (feature flag) |
|   ProviderCard existente reutilizado     |
+------------------------------------------+
| SERVICOS RECENTES                        |
|   Query: services + provider join        |
|   Cards com nome, categoria, preco       |
+------------------------------------------+
| PROFISSIONAIS POR CIDADE                 |
|   Grid de cidades (existente)            |
|   Links: /cidade/{slug}                  |
+------------------------------------------+
| CTA CADASTRO                             |
|   "Quer mais clientes?"                  |
|   Botao: Cadastrar servico -> /cadastro  |
+------------------------------------------+
| PATROCINADORES                           |
|   Query tabela sponsors WHERE active     |
|   Banners horizontais + cards            |
+------------------------------------------+
| COMO FUNCIONA (existente)                |
+------------------------------------------+
| DEPOIMENTOS (feature flag, existente)    |
+------------------------------------------+
| FAQ (feature flag, existente)            |
+------------------------------------------+
| FOOTER (existente)                       |
+------------------------------------------+
```

**Estilo visual Triider:**
- Hero com fundo claro (branco/gradiente suave), sem imagem de fundo escura
- Categorias em cards minimalistas com icones emoji maiores e bordas sutis
- Sem segmentacao por grupos (layout flat, 6 categorias principais em destaque)
- Todas as categorias acessiveis via link "Ver todas"

**Componentes reutilizados:**
- `Header` (sem mudancas)
- `Footer` (sem mudancas)
- `SearchBar` (hero variant existente)
- `ProviderCard` (profissionais em destaque)
- `CategoryCard` (categorias populares)
- Feature flags existentes (`featured_providers_enabled`, `faq_enabled`, `reviews_enabled`, `popular_searches_enabled`)

**Novo componente necessario:**
- Secao "Servicos Recentes" - query nos ultimos 6 servicos cadastrados com join em providers/categories

### 3. Nova pagina Admin: Gerenciar Patrocinadores (`src/pages/AdminSponsorsPage.tsx`)

- CRUD completo na tabela `sponsors`
- Campos: titulo, URL da imagem, URL do link, posicao (banner/card/featured), ativo/inativo, ordem
- Adicionar rota `/admin/patrocinadores` no `App.tsx`
- Adicionar link no menu do `AdminLayout.tsx`

### 4. Dashboard: Contador de servicos

No `DashboardPage.tsx`, adicionar "Servicos cadastrados" ao array `stats` usando o `servicesCount` que ja e buscado. Mudanca minima: substituir um dos stats placeholder ou adicionar um novo card.

### 5. Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Index.tsx` | Redesign completo do layout |
| `src/pages/DashboardPage.tsx` | Adicionar stat de servicos |
| `src/pages/AdminSponsorsPage.tsx` | **Novo** - CRUD de patrocinadores |
| `src/components/AdminLayout.tsx` | Adicionar link "Patrocinadores" no menu |
| `src/App.tsx` | Adicionar rota `/admin/patrocinadores` |
| Migration SQL | Criar tabela `sponsors` |

### 6. Impacto

- **Zero** mudanca na logica de negocio (busca, categorias, cadastro, leads)
- **Zero** mudanca no backend existente (apenas nova tabela `sponsors`)
- Todas as queries existentes (`useCategoriesWithCount`, `useFeaturedProviders`, cidades) continuam iguais
- Feature flags continuam funcionando
- SEO: links `/categoria/{slug}` e `/cidade/{slug}` mantidos

