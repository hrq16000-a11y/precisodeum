

## Plano: Lista de busca com ordem aleatória e animações premium

### O que muda

A lista de sugestões da barra de busca terá os itens em **ordem aleatória** (embaralhados) cada vez que aparecer, e cada item entrará com **animações staggered** (escalonadas) para um efeito sofisticado e atrativo.

### Alterações em `src/components/SearchBar.tsx`

1. **Shuffle dos itens trending** --- ao montar a lista de trending (sem query), embaralhar o array com Fisher-Yates para que a ordem mude a cada abertura do dropdown.

2. **Animações staggered nos itens** --- cada item da lista recebe um `style` com `animation` CSS inline usando delay incremental (`i * 60ms`), criando um efeito cascata onde cada item desliza suavemente para dentro com fade e leve translação.

3. **Efeito de entrada no container** --- o dropdown inteiro recebe uma animação de `scale-in` + `fade-in` sutil ao abrir.

4. **Micro-interação no hover** --- cada item ganha um efeito de escala sutil (`scale(1.01)`) e transição de cor de fundo com gradiente suave ao passar o mouse.

5. **Ícone com brilho** --- o ícone/emoji de cada item recebe um fundo com gradiente sutil e uma sombra colorida leve para dar sofisticação.

6. **Badge de tipo com cor contextual** --- os badges "Popular", "Categoria", "Serviço", "Cidade" ganham cores distintas por tipo (accent para popular, azul para categoria, etc).

### Detalhes técnicos

- Animação CSS inline via `style={{ animationDelay }}` com keyframe `suggestion-slide-in` adicionado ao `index.css`
- Shuffle feito com `useMemo` usando seed baseado no estado `isOpen` para re-embaralhar ao reabrir
- Sem dependência nova --- apenas CSS e lógica de array

