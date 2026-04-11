

# Fix: Touch Navigation nas Imagens do ImageLightbox

## Problema

O código do `ImageLightbox.tsx` já tem os touch handlers implementados corretamente no wrapper div (linhas 178-183), mas há um conflito: o `onClick={handleTap}` no mesmo div dispara após o `onTouchEnd`, interferindo com o swipe. Além disso, o `handleTap` não verifica `swiping.current`, então após um swipe o click event ainda é processado.

## Solução

**Arquivo:** `src/components/ImageLightbox.tsx`

1. **Prevenir conflito click/touch**: No `handleTap`, verificar `swiping.current` — se `true`, ignorar o tap e resetar a flag
2. **Resetar swiping no touchEnd**: Garantir que `swiping.current` seja resetado corretamente após processar o swipe (atualmente é resetado no touchStart, mas pode ficar `true` quando o click dispara)
3. **Prevenir default no touchMove** para swipes horizontais (não apenas pinch), evitando que o browser trate o gesto como scroll/navigation

Mudanças no `handleTap`:
```tsx
const handleTap = useCallback(() => {
  if (swiping.current) { swiping.current = false; return; }
  // ... double-tap logic
}, [scale, resetZoom, flashControls]);
```

Mudança no `onTouchMove` — adicionar `e.preventDefault()` quando detectar swipe horizontal:
```tsx
if (dxAbs > dyAbs && dxAbs > 10) {
  swiping.current = true;
  e.preventDefault(); // prevent browser back/forward gesture
}
```

Alteração confinada a um único arquivo, sem dependências.

