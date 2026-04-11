

## Plano: Compartilhamento, Solicitação de Avaliação e SEO Dinâmico

### Estado Atual
- **SEO já implementado** (linha 516-522): `useSeoHead` já gera título dinâmico `[Nome] - [Categoria] em [Cidade] | Preciso de um` e meta description com avaliações. ✅
- **Botão "Copiar Link"** já existe (linha 1148-1152), mas sem Web Share API. Precisa upgrade.
- **Não existe** lógica de `isOwner` nem botão "Pedir Avaliação".

---

### 1. Botão "Compartilhar Perfil" — Upgrade do "Copiar Link" existente

**Arquivo: `src/pages/ProviderProfile.tsx`**

Substituir o botão "Copiar Link" (linha 1148-1152) por um botão "Compartilhar" que:
- Usa `navigator.share()` se disponível (mobile), com título e texto do profissional
- Fallback: `navigator.clipboard.writeText()` + toast "Link do perfil copiado!"
- Ícone: `Share2` (Lucide) em vez de `Copy`
- Mover para posição mais proeminente — ao lado dos botões CTA principais (não escondido num flex secundário)

### 2. Botão "Pedir Avaliação" — Exclusivo para o dono do perfil

**Arquivo: `src/pages/ProviderProfile.tsx`**

- Importar `useAuth` e obter `user`
- Calcular `isOwner = user?.id === provider?.user_id`
- Se `isOwner`, renderizar um botão destacado "⭐ Pedir Avaliação" logo após os CTAs
- Ao clicar, gera link WhatsApp com mensagem pré-pronta:
  `"Olá! Agradeço por escolher meus serviços. Poderia me avaliar rapidinho na plataforma? Isso fortalece meu trabalho! {profileUrl}"`
- Usa `whatsappLink('', mensagem)` — abre WhatsApp sem número pré-definido (o profissional escolhe o contato)
- Fallback: se WhatsApp indisponível, copia a mensagem para clipboard

### 3. SEO Dinâmico — Já implementado ✅

O `useSeoHead` na linha 516-522 já gera:
- `<title>`: "Henrique da Cruz - Manutenção em São José dos Pinhais | Preciso de um"
- `<meta description>`: com nome, categoria, cidade, avaliações e nota
- `og:title`, `og:description`, `og:url`, canonical — todos dinâmicos
- JSON-LD LocalBusiness com aggregateRating (linhas 534-549)

Apenas ajustar: passar `ogImage` com o avatar do profissional para que o compartilhamento social mostre a foto dele.

---

### Detalhes técnicos

```text
Hierarquia dos CTAs (atualizada):
┌────────────────────────────────────────┐
│  [Solicitar Orçamento] [WhatsApp]      │
│  [Compartilhar] [Ligar]                │
│  "Orçamento sem compromisso..."        │
├────────────────────────────────────────┤
│  (se isOwner):                         │
│  [⭐ Pedir Avaliação via WhatsApp]     │
│  "Envie para clientes recentes"        │
└────────────────────────────────────────┘
```

### Arquivo modificado
- `src/pages/ProviderProfile.tsx` — único arquivo alterado

