## Plano: Seletor Inteligente de Categorias (SmartCategoryPicker)

### Problema Atual

O seletor de categorias é uma lista plana de ~171 itens sem hierarquia visual. O usuário não vê a relação Macro → Subcategoria, e a busca é um simples `includes()` sem fuzzy matching.

### Solução

Criar `src/components/SmartCategoryPicker.tsx` — componente reutilizável com:

**1. Interface visual**

- Campo de input com chips das categorias selecionadas
- Dropdown com busca integrada
- Resultados agrupados por macro-categoria (7 grupos visuais com headers)
- Subcategorias indentadas sob cada macro
- Ícone + nome em cada item

**2. Busca inteligente**

- Normalização de acentos (`técnico` = `tecnico`)
- Fuzzy parcial (digitar "eletric" encontra "Eletricista", "Eletricista Residencial", etc.)
- Quando busca ativa: mostrar apenas subcategorias que matcham, com o header da macro visível
- Resultado vazio: mensagem "Nenhuma categoria encontrada"

**3. Hierarquia visual**

- Headers de macro-categoria (não clicáveis como seleção, apenas agrupamento)
- Subcategorias clicáveis com indentação
- Checkbox visual nos itens selecionados
- Suporte a multi-select (já existente no fluxo atual)

**4. Props do componente**

```typescript
interface SmartCategoryPickerProps {
  categories: Category[];           // lista completa (macros + subs)
  selectedIds: string[];            // IDs selecionados
  onToggle: (id: string) => void;   // toggle seleção
  maxSelections?: number;           // limite opcional
}
```

### Arquivos alterados


| Arquivo                                      | Mudança                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `src/components/SmartCategoryPicker.tsx`     | **Novo** — componente completo                                          |
| `src/pages/DashboardServicesPage.tsx`        | Substituir bloco de categoria (linhas 442-489) pelo SmartCategoryPicker |
| `src/components/admin/ServiceEditDialog.tsx` | Substituir Select simples (linhas 133-141) pelo SmartCategoryPicker     |


### Zero alterações no banco

A estrutura `categories` com `parent_id` já está correta. Nenhuma migração necessária.

&nbsp;

&nbsp;

Plano pode ser mantido com adaptações obrigatórias abaixo:

Tornar a busca obrigatoriamente fuzzy (não opcional) com fallback de similaridade, não só includes()

Garantir que o componente permita seleção por digitação direta + criação implícita (texto livre válido) sem dependência de “nenhuma categoria encontrada”

Remover comportamento de “resultado vazio: mensagem bloqueante” → deve ser apenas informativa, nunca impeditiva

Subcategoria não pode ser tratada como dependência rígida de UI (não pode travar seleção principal)

Garantir que seleção de categoria não seja pré-requisito de fluxo de publicação

Restante do plano está OK e pode ser mantido.