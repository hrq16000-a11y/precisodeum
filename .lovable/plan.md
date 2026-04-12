# Revolução UI/UX — Busca Preditiva e Grid Premium

## Escopo

Transformar o grid de categorias e a barra de busca em uma experiência de alta conversão, com badges de quantidade, chips com emojis, seção "Top Categories", busca por problema com NLP, dropdown de buscas em alta, estimativa de preço, WhatsApp contextual e skeleton loading aprimorado.

## O que será implementado

### 1. Grid de Categorias Premium (CategoriesGrid.tsx)

- **Cards modernos**: Cantos 24px, fundo branco, sombra suave (já parcialmente implementado — refinar)
- **Seção "Top Categories"**: Grid destacado com as 4 categorias mais populares (maior count) com ícones maiores, antes do grid principal

### 2. Barra de Busca Inteligente (SearchBar.tsx)

- **Busca por problema**: Já existe o `naturalLanguageMap.ts` — integrar o resultado NLP diretamente no dropdown com um card visual ("Entendemos: você precisa de um Encanador 🔧")
- **Dropdown "Buscas em Alta"**: Já implementado — aprimorar com ícone Lucide-React de 🔥 e badge "Popular" mais visível
- **Sugestão contextual**: Ao detectar NLP match, mostrar card destacado no topo do dropdown

### 3. Estimativa de Preço (novo componente)

- **PriceEstimateWidget**: Card flutuante na SearchPage que exibe "Faixa de preço estimada para [Categoria] em [Cidade]: R$ X - R$ Y"
- **Lógica**: Tabela `price_estimates` com faixas por categoria (seed com dados altos) ou cálculo simples baseado em médias altas hardcoded por categoria
- **Abordagem simples**: Mapa estático de faixas de preço por slug de categoria (sem tabela extra inicialmente)

### 4. WhatsApp Smart-Link (ProviderCard + CategoryCard)

- **Mensagem contextual**: Já implementado em `whatsapp.ts` com `buildSmartMessage` — garantir que todos os cards usem essa função
- **Botão WhatsApp no card de categoria**: Se houver profissionais com `is_online = true` dentro de 5km, mostrar botão "WhatsApp Rápido" no card

### 5. Performance Visual

- **Skeleton loading**: Já implementado — refinar com skeleton no formato exato dos novos cards
- **Contador de confiança**: O `ActiveProvidersCounter` já existe — reposicionar abaixo da busca no hero

## Arquivos a criar/modificar


| Arquivo                                       | Ação                                                  |
| --------------------------------------------- | ----------------------------------------------------- |
| `src/components/home/CategoriesGrid.tsx`      | Redesign com badges, top categories, chips com emojis |
| `src/components/SearchBar.tsx`                | Integrar NLP match visual no dropdown                 |
| `src/components/home/PriceEstimateWidget.tsx` | Novo — card de estimativa de preço                    |
| `src/lib/priceEstimates.ts`                   | Novo — mapa de faixas de preço por categoria          |
| `src/pages/SearchPage.tsx`                    | Adicionar PriceEstimateWidget                         |
| `src/components/CategoryCard.tsx`             | Adicionar badge de quantidade                         |
| `src/pages/CategoriesListPage.tsx`            | Adicionar badge de quantidade nos cards               |


**NLP no dropdown**: Usar `matchNaturalLanguage(query)` do mapa existente. Se match, renderizar um card destacado no topo: "Entendemos: você precisa de um **{categoria}** → Ver profissionais".

**Estimativa de preço**: Mapa estático `Record<string, {min: number, max: number}>` com ~15 categorias principais. Exibido como card sutil na SearchPage quando há match de categoria.

**Chips com emojis**: Mapeamento emoji Lucide-React por macro-categoria baseado no nome/slug existente.