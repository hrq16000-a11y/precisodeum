# Plano: Índices de Performance + Importação em Massa de Categorias

## Situação Atual

- **171 categorias** existentes (7 macros, 164 subcategorias)
- Hierarquia `parent_id` já funcional
- Slug único com constraint `categories_slug_key`
- Trigger `sanitize_provider_slug` já sanitiza slugs no banco
- **Faltam**: índices em `parent_id` e `(slug, deleted_at)`

---

## Fase 1 — Migration: Índices de Performance

Criar migration SQL com 3 índices:

```sql
-- Índice para consultas hierárquicas (drill-down de subcategorias)
CREATE INDEX IF NOT EXISTS idx_categories_parent_id
ON categories(parent_id) WHERE parent_id IS NOT NULL;

-- Índice para SEO (lookup de slug ignorando deletados)
CREATE INDEX IF NOT EXISTS idx_categories_slug_active
ON categories(slug) WHERE deleted_at IS NULL;

-- Índice para ordenação alfabética em listagens
CREATE INDEX IF NOT EXISTS idx_categories_order_name
ON categories(name ASC);
```

**Ferramenta**: Database migration tool

---

## Fase 2 — Insert: Categorias em Massa (3 grupos)

Após os índices, inserir subcategorias novas via **insert tool** nas 3 macros solicitadas. As macros já existem no banco:


| Macro existente             | Slug no banco                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------- |
| Construção e Reforma        | `construcao-e-reforma`                                                                |
| (criar) Assistência Técnica | `assistencia-tecnica` — já existe como subcategoria, será promovida ou usada como pai |
| (criar) Serviços Domésticos | `servicos-domesticos` — precisa ser criada como macro                                 |


**Nota**: "Assistência Técnica" já existe como subcategoria (`slug: assistencia-tecnica`, `parent_id` = Tecnologia). Precisaremos criar uma nova macro ou reutilizar a existente. O script usará `ON CONFLICT (slug) DO NOTHING` para segurança.

### Subcategorias a inserir (~40 novos registros):

**Reformas** (sob `construcao-e-reforma`): Impermeabilizador, Telhadista, Instalador de Papel de Parede, Instalador de Pisos, Demolição, Paisagista, Instalador de Cerca Elétrica, Instalador de Porta, Instalador de Portão, Limpeza de Caixa d'Água, Dedetizador, Instalador de Energia Solar

**Assistência Técnica** (nova macro): Conserto de Geladeira, Conserto de Máquina de Lavar, Conserto de Micro-ondas, Conserto de Fogão, Conserto de Videogame, Conserto de Impressora, Instalação de CFTV, Conserto de Portão Eletrônico

**Serviços Domésticos** (nova macro): Diarista, Passadeira, Cozinheira, Babá, Limpeza Pós-Obra, Personal Organizer, Adestrador de Cães, Passeador de Cães, Cuidador de Idosos

Todos os slugs serão gerados manualmente no padrão `kebab-case` sem acentos, e a trigger `sanitize_provider_slug` do banco garantirá a sanitização final.

---

## Resumo de Ações


| Passo | Ferramenta | O quê                                                                 |
| ----- | ---------- | --------------------------------------------------------------------- |
| 1     | Migration  | 3 índices (`parent_id`, `slug+deleted_at`, `name`)                    |
| 2     | Insert     | Criar 2 novas macros (Assistência Técnica macro, Serviços Domésticos) |
| 3     | Insert     | ~40 subcategorias distribuídas nas 3 macros                           |


**Nenhuma alteração de código** é necessária — o `SmartCategoryPicker`, `CategoriesListPage` e rotas SEO já consomem a tabela `categories` dinamicamente.

...

&nbsp;

"O plano está perfeito. Pode prosseguir com as duas fases (Migration e Insert).

Adicione os seguintes detalhes na execução:

Promoção de Categoria: Para 'Assistência Técnica', como ela já existe sob 'Tecnologia', por favor, transforme-a em uma macro-categoria (parent_id = NULL) para que ela tenha o peso necessário na plataforma, conforme o padrão de mercado.

Ícones e SEO: Ao inserir as ~40 subcategorias, já preencha a coluna de icon_name (use nomes compatíveis com a biblioteca Lucide) e a coluna de description (ou metadata) com uma breve descrição focada em SEO para cada serviço.

Validação de Slugs: Certifique-se de que todos os novos registros sigam rigorosamente o padrão kebab-case (ex: limpeza-de-caixa-dagua).

Assim que concluir, me confirme se os índices foram aplicados com sucesso e liste as novas categorias criadas."