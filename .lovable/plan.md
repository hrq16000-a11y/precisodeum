## Plano: Refatoracao Premium — Prova Social, Confianca e Conversao

### Visao Geral

Transformar a pagina de perfil e o card de listagem em "paginas de venda" do profissional, com prova social forte, selos de confianca e gatilhos de urgencia que guiam o olhar do usuario ate o botao de WhatsApp.

---

### 1. Componente TrustShield — Selo de Verificacao Verde (Novo)

**Arquivo:** `src/components/TrustShield.tsx`

Criar componente reutilizavel com icone `ShieldCheck` verde e texto "Identidade Verificada" ou "Documentacao Verificada". Aparece no perfil (header card) e no ProviderCard. Substitui o badge atual de "Verificado" por algo mais visualmente impactante — fundo verde claro, borda verde, icone solido.

### 2. Componente ReviewSummary — Resumo de Avaliacoes (Novo)

**Arquivo:** `src/components/ReviewSummary.tsx`

Bloco compacto com: nota grande (ex: 4.9), estrelas preenchidas, total de avaliacoes, e badge de ranking (Top Rated Ouro/Prata/Bronze baseado na nota). Usado no topo do perfil logo apos o nome, e como versao compacta no ProviderCard.

Ranking:

- Ouro: rating >= 4.8 e reviewCount >= 10
- Prata: rating >= 4.5 e reviewCount >= 5
- Bronze: rating >= 4.0 e reviewCount >= 3

### 3. Componente TestimonialsCarousel — "Resultados Reais" (Novo)

**Arquivo:** `src/components/TestimonialsCarousel.tsx`

Secao no perfil que mostra os ultimos 3 reviews em cards com aspas, nome do cliente e estrelas. Titulo: "O que dizem nossos clientes". Usa dados reais de `reviews[]`. Se nao houver reviews, nao renderiza.

### 4. Tags de Urgencia e Microcopy de Conversao (Novo)

**Arquivo:** `src/components/ConversionTags.tsx`

Tags dinamicas renderizadas proximo ao CTA:

- "🔥 Muito requisitado na sua regiao" — se `review_count >= 5`
- "⚡ Responde rapido" — se `response_time` existe
- "✅ Orcamento sem compromisso" — sempre visivel

Microcopy abaixo dos botoes CTA: "Orcamento sem compromisso. Fale direto com o profissional."

### 5. Banner de Garantia (Novo)

**Arquivo:** `src/components/TrustGuarantee.tsx`

Pequeno banner discreto no perfil: icone de escudo + "Contratacao Segura — O combinado nao sai caro." Aparece entre as secoes, usando fundo `accent/5`.

### 6. Refatorar ProviderProfile.tsx

**Arquivo:** `src/pages/ProviderProfile.tsx`

Integrar todos os novos componentes no header card e nas secoes:

- **ReviewSummary** logo apos o nome/categoria (substitui o StarRating atual no header)
- **TrustShield** no bloco de badges (substitui o badge simples "Perfil verificado")
- **ConversionTags** entre os stats mini cards e os botoes CTA
- **Microcopy** abaixo dos botoes CTA: texto pequeno em `muted-foreground`
- **TrustGuarantee** banner apos a secao "Sobre"
- **TestimonialsCarousel** como nova secao no `sectionMap` (apos reviews ou apos about)
- Renomear titulo do Portfolio de "Portfolio" para "Trabalhos Realizados"

### 7. Refatorar ProviderCard.tsx (Card de Listagem)

**Arquivo:** `src/components/ProviderCard.tsx`

- Substituir badge "Verificado" pelo **TrustShield** compacto (versao `size="sm"`)
- Adicionar badge de ranking (Ouro/Prata/Bronze) ao lado do nome quando aplicavel
- Adicionar tag "⚡ Responde rapido" se `response_time` existe
- Adicionar microcopy "Orcamento sem compromisso" em texto pequeno abaixo dos botoes

### 8. Refatorar FeaturedProviders.tsx (Card da Home)

**Arquivo:** `src/components/home/FeaturedProviders.tsx`

- Mesmo tratamento do ProviderCard: badge de ranking, TrustShield compacto, microcopy

### 9. Remover filtro "Menor Preco" e garantir ordenacao correta

**Arquivo:** `src/pages/SearchPage.tsx`

O sort atual ja nao tem "menor preco" (confirmado). Manter apenas: Relevancia, Melhor Avaliacao, Mais Avaliacoes, Mais Experiencia, Nome A-Z/Z-A. Nenhuma alteracao necessaria — ja esta correto.

---

### Arquivos criados:

- `src/components/TrustShield.tsx`
- `src/components/ReviewSummary.tsx`
- `src/components/TestimonialsCarousel.tsx`
- `src/components/ConversionTags.tsx`
- `src/components/TrustGuarantee.tsx`

### Arquivos modificados:

- `src/pages/ProviderProfile.tsx`
- `src/components/ProviderCard.tsx`
- `src/components/home/FeaturedProviders.tsx`

### Detalhes tecnicos

```text
Hierarquia visual do perfil (de cima para baixo):
┌─────────────────────────────────────┐
│  Avatar + Nome + Badges (Destaque,  │
│  TrustShield, Ranking Ouro/Prata)   │
│  Categoria + Localizacao            │
│  ReviewSummary (4.9 ★★★★★ 23 av.)  │
├─────────────────────────────────────┤
│  Stats Mini Cards                   │
├─────────────────────────────────────┤
│  ConversionTags (🔥⚡✅)            │
├─────────────────────────────────────┤
│  [Solicitar Orcamento] [WhatsApp]   │
│  "Orcamento sem compromisso..."     │
├─────────────────────────────────────┤
│  Sobre o profissional               │
│  TrustGuarantee banner              │
├─────────────────────────────────────┤
│  Trabalhos Realizados (Portfolio)    │
│  Servicos                           │
│  Resultados Reais (Testimonials)    │
│  Avaliacoes                         │
└─────────────────────────────────────┘
```

Todos os componentes usam `framer-motion` para animacoes de entrada, cores do tema (`accent`, `muted-foreground`, `emerald` para trust), e sao responsivos mobile-first.

&nbsp;

.....

&nbsp;

&nbsp;

Correção 

&nbsp;

&nbsp;

Ajuste Crítico de Regra de Negócio:

O plano geral está aprovado em termos de hierarquia e conversão, mas precisamos fazer um Ajuste Crítico de Escopo referente à responsabilidade da plataforma. Nossa plataforma é um guia comercial público. Nós NÃO fazemos validação de documentos (identidade, antecedentes) e NÃO intermediamos o serviço. Portanto, não podemos usar termos que impliquem responsabilidade jurídica da plataforma.

Execute o plano com as seguintes modificações:

Cancele o "TrustShield" de Identidade: Em vez de "Identidade Verificada", transforme o TrustShield no componente ProfileBadge. Ele deve exibir selos de engajamento na plataforma, como: "Perfil Completo" (se ele tem foto e serviços cadastrados) ou "Membro Ativo". A cor pode ser um azul de destaque ou laranja da marca, evitando o verde-escudo que remete à verificação governamental/bancária.

Refatore o "TrustGuarantee" (Banner de Garantia): Como não garantimos o serviço, altere a cópia (texto) deste banner para focar na transparência da plataforma. O novo texto deve ser: "Negociação Direta: Sem taxas ocultas. Combine os detalhes do serviço diretamente com o profissional." Use um ícone de "Aperto de mãos" (Handshake) em vez de um Escudo.

Confirmação do WhatsApp: Confirme se o Passo 7 (incluir o botão do WhatsApp lado a lado com o deep link whatsapp://send?phone=...) está mantido na nova hierarquia visual.

Pode prosseguir com a implementação do plano atualizado.