

# Fix: Header Sticky Não Funciona ao Rolar

## Causa Raiz

A regra `overflow-x: hidden` aplicada ao `html` e `body` em `src/index.css` (linha 92-94) **quebra o `position: sticky`** na maioria dos navegadores. Quando `overflow-x: hidden` está no `html`, o navegador cria um novo contexto de rolagem que impede o sticky de funcionar.

## Solução

### `src/index.css`

Remover `overflow-x: hidden` do `html` e manter apenas no `body`. Isso preserva a proteção contra scroll horizontal sem quebrar o sticky:

```css
/* De: */
html, body {
  overflow-x: hidden;
}

/* Para: */
body {
  overflow-x: clip;
}
```

Usar `overflow-x: clip` no `body` em vez de `hidden` — `clip` previne scroll horizontal mas **não cria um novo contexto de rolagem**, preservando o sticky do Header.

## Arquivo alterado

| Arquivo | Ação |
|---------|------|
| `src/index.css` | Trocar `overflow-x: hidden` em html,body por `overflow-x: clip` apenas no body |

## Impacto
- Header sticky funciona corretamente em todos os navegadores
- Sem scroll horizontal indesejado
- Zero breaking changes

