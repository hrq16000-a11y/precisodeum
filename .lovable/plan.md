

# Correção da Galeria de Imagens no Modal de Serviço + Formatação de Localização

## Problemas Identificados

1. **Imagens espremidas**: Na linha 1410 do `ProviderProfile.tsx`, as imagens usam `object-contain` em vez de `object-cover`, causando espaço vazio e aspecto "espremido"
2. **Localização mal formatada**: A string `service_area` exibe "Pinhais, Piraquara , São José dos Pinhais , E região metropolitana" com espaços antes das vírgulas
3. **Sem scroll por touch**: A galeria usa grid fixo sem suporte a swipe horizontal no mobile

## Alterações

### 1. `src/pages/ProviderProfile.tsx` — ServiceDetailDialog

**Galeria de imagens:**
- Linha 1410: trocar `object-contain bg-muted/30` por `object-cover`
- Converter o grid em carrossel horizontal com scroll por touch no mobile:
  - `overflow-x-auto snap-x snap-mandatory` no container
  - Cada imagem como `snap-center min-w-[75%]` no mobile, grid normal no desktop
  - CSS `touch-action: pan-x` para garantir swipe suave

**Localização formatada (linha 1427):**
- Criar função `formatLocationString(str)` que remove espaços antes de vírgulas, trim, e capitaliza
- Aplicar na exibição de `service.service_area`

### 2. `src/pages/ServiceDetailPage.tsx` — Página individual

- Linha 133: trocar `object-cover` (já correto) — verificar consistência
- Aplicar mesma função de formatação na exibição de `service_area`

### 3. `src/lib/normalize.ts` — Nova função utilitária

- Exportar `formatLocationString(text: string): string`
- Remove espaços antes de vírgulas (` ,` → `,`)
- Remove vírgulas duplicadas
- Trim e capitaliza primeira letra de cada segmento
- Ex: `"Pinhais, Piraquara , São José dos Pinhais , E região metropolitana"` → `"Pinhais, Piraquara, São José dos Pinhais e região metropolitana de Curitiba"`

## Detalhes Técnicos

| Arquivo | Alteração |
|---|---|
| `src/lib/normalize.ts` | Nova função `formatLocationString` |
| `src/pages/ProviderProfile.tsx` | `object-cover` + carrossel touch + formatação de localização |
| `src/pages/ServiceDetailPage.tsx` | Aplicar `formatLocationString` no `service_area` |

