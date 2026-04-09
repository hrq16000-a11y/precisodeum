

# Centralizar Sistema de Patrocinadores — Fonte Única de Verdade

## Problema Atual

O sistema possui **duas camadas de dados paralelas** e **lógica dispersa** em cada componente:

- `useSponsorsByPosition` (em `SponsorAd.tsx`) — filtra por `position`
- `useSponsorsByType` (em `useSponsors.ts`) — filtra por `sponsor_type` (global/city/category)
- Cada componente define seus próprios limites hardcoded (`slice(0, 2)`, `slice(0, 3)`, `slice(0, 6)`)
- `POSITION_MAP` existe apenas no admin, sem compartilhamento com o frontend
- `SponsorSidebarWidget` ainda usa `useSponsorsByType` ao invés de `position`

## Solução

### 1. Criar configuração central compartilhada

Novo arquivo: `src/config/sponsorPositions.ts`

Contém o **POSITION_CONFIG** — mapa único usado tanto pelo admin quanto pelo frontend:

```text
position       | layout    | maxItems | aspect   | requiresImage | where
─────────────────────────────────────────────────────────────────────────
hero-top       | banner    | 3        | 8:1      | true          | Faixa topo
featured       | card-grid | 3        | card     | true          | Cards destaque
card           | card-grid | 6        | 5:3      | true          | Parceiros grid
banner         | banner    | 3        | 8:1      | true          | Banner interno
between-sections| banner   | 2        | 8:1      | true          | Entre seções
mid-content    | card-grid | 2        | card     | true          | Cards inline
showcase       | carousel  | 6        | 4:3      | true          | Carrossel home
sidebar        | vertical  | 3        | 300x250  | false         | Lateral desktop
native         | card      | 1        | card     | true          | Card nativo
footer         | banner    | 1        | 728x90   | true          | Acima rodapé
```

Cada entrada inclui: `position`, `label`, `description`, `layout`, `maxItems`, `dimensions`, `requiresImage`, `icon`, `color`.

### 2. Criar hook central `useSponsorsBySlot`

Novo hook em `src/hooks/useSponsors.ts` que substitui tanto `useSponsorsByPosition` quanto `useSponsorsByType`:

- Recebe `position` como parâmetro
- Busca do banco filtrando por `position` + `active` + `status`
- Aplica validação de datas automaticamente
- Aplica `requiresImage` do config (filtra sponsors sem imagem se necessário)
- Aplica `maxItems` do config (sem `slice` hardcoded nos componentes)
- Ordena por `display_order`
- Retorna dados prontos para renderização

A função `useSponsorsByPosition` existente em `SponsorAd.tsx` será movida para `useSponsors.ts` e refatorada para usar o config central.

### 3. Refatorar componentes para usar o hook central

Cada componente passa a importar de `useSponsors.ts` e **remove toda lógica local** de filtragem/limite:

| Componente | Antes | Depois |
|---|---|---|
| `SponsorTopBanner` | `useSponsorsByPosition('featured')` + `slice(0,3)` | `useSponsorsBySlot('featured')` — limite vem do config |
| `SponsorMidContent` | `useSponsorsByPosition('mid-content')` + `slice(0,2)` | `useSponsorsBySlot('mid-content')` |
| `SponsorSidebarWidget` | 3x `useSponsorsByType` + `slice(0,3)` | `useSponsorsBySlot('sidebar')` |
| `SponsorLeaderBanner` | `useSponsorsByPosition('hero-top')` + filter manual | `useSponsorsBySlot('hero-top')` |
| `SponsorsSection` | recebe props + `slice(0,6)` | `useSponsorsBySlot('card')` internamente (auto-suficiente) |
| `SponsorAd` | `useSponsorsByPosition` interno | `useSponsorsBySlot(position)` |
| `AdBanner` | `useSponsorsByPosition(position)` | `useSponsorsBySlot(position)` |
| `AdShowcase` | `useSponsorsByPosition('showcase')` | `useSponsorsBySlot('showcase')` |
| `AdNativeCard` | `useSponsorsByPosition('native')` | `useSponsorsBySlot('native')` |

### 4. Admin usa o mesmo config

`AdminSponsorsPage.tsx` importa `POSITION_CONFIG` de `sponsorPositions.ts` ao invés de manter seu próprio `POSITION_MAP`. Os selects, wireframe e tooltips passam a ler do config central.

### 5. Limpeza

- Remover `useSponsorsByType` e `useSponsorsByPosition` duplicados
- Remover `useAllActiveSponsors` (substituído pelo hook por posição)
- Manter `useSponsorSlotLimits` e `useRemainingSlots` como estão (escassez)
- Exportar o `POSITION_CONFIG` para que qualquer parte do sistema possa consultá-lo

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/config/sponsorPositions.ts` | **Criar** — config central |
| `src/hooks/useSponsors.ts` | **Reescrever** — hook único `useSponsorsBySlot` |
| `src/components/SponsorAd.tsx` | Remover `useSponsorsByPosition`, usar hook central |
| `src/components/sponsors/SponsorTopBanner.tsx` | Usar hook central, remover slice |
| `src/components/sponsors/SponsorMidContent.tsx` | Usar hook central, remover slice |
| `src/components/sponsors/SponsorSidebarWidget.tsx` | Usar hook central, remover `useSponsorsByType` |
| `src/components/sponsors/SponsorLeaderBanner.tsx` | Usar hook central |
| `src/components/home/SponsorsSection.tsx` | Auto-suficiente com hook central, remover slice |
| `src/components/ads/AdBanner.tsx` | Usar hook central |
| `src/components/ads/AdShowcase.tsx` | Usar hook central |
| `src/components/ads/AdNativeCard.tsx` | Usar hook central |
| `src/pages/AdminSponsorsPage.tsx` | Importar POSITION_CONFIG do config central |
| `src/pages/Index.tsx` | Simplificar — SponsorsSection busca seus próprios dados |

## O que NAO muda

- Schema do banco de dados (nenhuma migração)
- RLS policies
- Tracking de impressões/cliques (mantido nos componentes)
- Componentes visuais (`SponsorPremiumCard`, `LeaderSponsor`, `SponsorImage`)
- Index02 / Index03 (congelados, ajuste mínimo de import)

