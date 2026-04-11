

## Plano: Adicionar animação sutil à logo do cabeçalho

### Problema
A logo do rodapé aparece com um efeito de fade-in ao entrar na viewport (comportamento natural do scroll), enquanto a logo do cabeçalho aparece sem nenhuma animação.

### Solução
Adicionar uma animação sutil de entrada na logo do cabeçalho usando framer-motion, consistente com o design system do projeto.

### Alteração

**Arquivo: `src/components/Header.tsx`**

1. Importar `motion` de `framer-motion`
2. Substituir a tag `<img>` da logo (linha 152-158) por `<motion.img>` com animação de fade-in + leve scale:
   - `initial={{ opacity: 0, scale: 0.95 }}`
   - `animate={{ opacity: 1, scale: 1 }}`
   - `transition={{ duration: 0.4, ease: "easeOut" }}`

Isso dá à logo do header o mesmo tipo de efeito suave que o resto da interface, sem afetar performance (animação ocorre apenas uma vez no mount).

### Arquivo modificado
- `src/components/Header.tsx`

