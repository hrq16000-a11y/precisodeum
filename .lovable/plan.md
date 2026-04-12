

# Ajuste de Header Sticky — Refinamentos

## Status Atual
O Header **já possui** `sticky top-0 z-50`, backdrop-blur, shadow dinâmica e modo compacto no scroll. As bases estão corretas.

## Problemas a Corrigir

1. **Fundo semi-transparente** — `bg-card/90` e `bg-card/95` permitem que texto do conteúdo "sangre" visualmente por trás do header ao rolar. Precisa ser **sólido** quando scrolled.
2. **Shadow condicional** — Atualmente aplica `shadow-sm` mesmo sem scroll. Deveria ser `shadow-none` no estado inicial e `shadow-md` apenas após scroll.
3. **Conteúdo atrás do header** — Como `sticky` naturalmente ocupa espaço no flow, não há problema de overlap. Mas o `AdSlot global-top` dentro do `<header>` pode causar saltos de layout.

## Alterações

### `src/components/Header.tsx` (linha 205-209)
- Estado **sem scroll**: `bg-card` (100% opaco, sem transparência) + `shadow-none`
- Estado **com scroll** (compact): `bg-card shadow-md` (100% opaco) + manter backdrop-blur como fallback visual
- Remover as opacidades `/80`, `/90`, `/95` que causam bleed-through

**De:**
```
isCompact
  ? 'bg-card/90 backdrop-blur-lg supports-[backdrop-filter]:bg-card/80 shadow-md'
  : 'bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80 shadow-sm'
```

**Para:**
```
isCompact
  ? 'bg-card backdrop-blur-lg shadow-md'
  : 'bg-card shadow-none'
```

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/components/Header.tsx` | Fundo sólido + shadow condicional |

## Impacto
- Header 100% opaco em todos os estados — texto nunca sangra
- Shadow aparece apenas no scroll — visual mais limpo
- Zero breaking changes, apenas refinamento de classes CSS

