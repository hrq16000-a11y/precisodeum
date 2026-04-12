

# Header Sticky + Busca Mobile no Scroll + Fix Texto Overflow

## Status do Sticky
O Header **já tem** `sticky top-0 z-50` (linha 205). Com o fix anterior de `overflow-x: clip`, o sticky deve estar funcionando. Nenhuma alteração necessária aqui.

## Alterações Necessárias

### 1. Barra de Busca no Header Mobile ao Rolar
Atualmente, o `CompactSearch` tem `hidden md:block` — só aparece no desktop. Vamos adicionar uma barra de busca compacta no mobile quando o usuário rolar.

**`src/components/Header.tsx`**
- No bloco mobile (linha 322-338): quando `isCompact` for true, mostrar um campo de busca inline compacto ao lado dos ícones
- Usar um ícone de busca que expande um input ao clicar, ou um input compacto fixo com `flex-1`
- Layout: `[Logo compacto] [🔍 input busca] [📍geo] [🔔] [☰]`

### 2. Fix Texto Overflow no Hero (RotatingServiceText)
**`src/components/home/RotatingServiceText.tsx`**
- Linha 70: remover `min-w-[180px] sm:min-w-[260px]` — usar `w-full max-w-full min-w-0`
- Linha 74: remover `whitespace-nowrap` — permitir quebra de linha no mobile
- Ajustar `height: 1.2em` para `min-height: 1.2em` para acomodar 2 linhas no mobile
- Manter `whitespace-nowrap` apenas em `sm:` para telas maiores onde cabe

### 3. Ajuste no h1 do HeroBanner
**`src/components/home/HeroBanner.tsx`**
- Garantir que o `h1` tenha `overflow-hidden` e `max-w-full` para nunca ultrapassar a viewport
- Adicionar `px-4` no container do texto para margem segura no mobile

## Arquivos alterados
| Arquivo | O que muda |
|---------|-----------|
| `src/components/Header.tsx` | Busca compacta visível no mobile ao rolar |
| `src/components/home/RotatingServiceText.tsx` | Remover nowrap/min-w, permitir wrap no mobile |
| `src/components/home/HeroBanner.tsx` | Overflow seguro no h1 |

