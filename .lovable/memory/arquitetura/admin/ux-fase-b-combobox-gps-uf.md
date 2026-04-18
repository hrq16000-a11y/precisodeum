---
name: UX Fase B - Combobox, GPS automático, UF e IconRenderer
description: Edge function geocode-address (Nominatim→IBGE), CategoryCombobox autocomplete, UFSelect padronizado, IconRenderer universal Lucide
type: feature
---
**CategoryCombobox** (`src/components/admin/CategoryCombobox.tsx`): substitui Selects simples de categoria com busca por digitação (normalizada sem acento). Usado em ProviderEditDialog. ServiceEditDialog mantém SmartCategoryPicker (hierárquico).

**UFSelect** (`src/components/admin/UFSelect.tsx`): exporta BR_UFS (27 siglas oficiais) e componente padronizado para seleção de estado. Substitui input livre. Suporta opção "Todos" via includeAll.

**Geocoding invisível**: Edge function `geocode-address` recebe `{address, neighborhood, city, state}` e retorna `{latitude, longitude, source}` via Nominatim com fallback simplificado. Helper `src/lib/geocodeAddress.ts` invoca via supabase.functions.invoke. ProviderEditDialog dispara automático ao trocar cidade E ao salvar (se mudou ou faltam coords). Sem botão manual.

**IconRenderer** (`src/components/ui/IconRenderer.tsx`): single source of truth para ícone-string-from-DB. Resolução: PascalCase → case-insensitive → kebab-case → CircleDot fallback. Já usado em AdminGamificationPage. AdminCategoriesPage usa DynIcon (mesma lógica via lucide icons map).
