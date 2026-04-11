

# Correção do ImageLightbox: Overlay Completo + Pinch-to-Zoom + Touch Aprimorado

## Problemas na Screenshot

1. **Overlay incompleto**: `bg-black/90` deixa UI de fundo visível (nav bar, chat bar). Precisa ser `bg-black` opaco
2. **Sem pinch-to-zoom**: Não há suporte a gesto de pinça
3. **Setas invisíveis no mobile**: Classe `hidden sm:flex` esconde setas no mobile
4. **Touch funcional mas sem feedback visual**: Sem indicador de transição entre imagens

## Alterações

**Arquivo:** `src/components/ImageLightbox.tsx`

1. **Overlay total**: Trocar `bg-black/90 backdrop-blur-sm` por `bg-black` + `z-[9999]` para cobrir tudo incluindo bottom nav
2. **Pinch-to-zoom**: Adicionar estado de scale/translate com dois dedos (touch events para pinch), transformando a imagem via CSS `transform: scale() translate()`
3. **Setas mobile**: Remover `hidden sm:flex`, mostrar setas semitransparentes que aparecem ao tocar e somem após 2s com `setTimeout`
4. **Transição suave**: Adicionar `transition-opacity` na troca de imagem para feedback visual
5. **Body scroll lock**: Adicionar `useEffect` que seta `document.body.style.overflow = 'hidden'` quando aberto

Sem dependências externas — tudo com touch events nativos do React.

