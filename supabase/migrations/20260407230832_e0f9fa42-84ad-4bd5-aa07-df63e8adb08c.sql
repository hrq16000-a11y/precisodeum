
INSERT INTO public.institutional_pages (slug, title, meta_title, meta_description, published, display_order, content)
VALUES (
  'diretrizes-banner-hero',
  'Diretrizes do Banner Patrocinado — Abaixo do Hero',
  'Diretrizes do Banner Patrocinado | Preciso de Um',
  'Regras e boas práticas para o espaço de banner patrocinado abaixo do hero principal.',
  true,
  99,
  '## BANNER PATROCINADO — ABAIXO DO HERO

Este espaço é destinado a patrocinadores e aparece logo abaixo da seção principal (hero), com foco em **alta visibilidade e clique**.

O sistema já está configurado e funcionando. As regras abaixo servem apenas para garantir uso correto e consistência visual.

---

### FORMATO DA IMAGEM (OBRIGATÓRIO)

- **Proporção:** 8:1
- **Tamanho:** 1600×200 px
- A imagem deve ser **única** (não usar versões diferentes)
- Deve funcionar em **largura total (100%)**
- Deve suportar **corte lateral em mobile** sem perder sentido
- Evitar elementos importantes nas bordas
- Priorizar **conteúdo central** (área segura de 70%)

---

### EXIBIÇÃO NO SITE

- **Posição:** abaixo do hero
- **Largura:** 100%
- **Altura adaptável** (máx. ~70px no mobile)
- **Margens:**
  - Topo: 12px
  - Laterais (padding): 12px
- **Borda arredondada:** 10px
- Espaço visual limpo e organizado

---

### COMPORTAMENTO

- Banner é **totalmente clicável**
- **Não utilizar botão** dentro da imagem
- Não depende de texto na imagem para funcionar
- A leitura deve ser visual (imagem limpa)

---

### INTEGRAÇÃO COM O SISTEMA

As informações do patrocinador **NÃO** devem estar na imagem.

O sistema já utiliza:
- **Nome da empresa** → exibido via sistema
- **Frase curta** → exibida via sistema
- **ALT da imagem** → gerado com base nesses dados (SEO + acessibilidade)

---

### IDENTIFICAÇÃO

- A tag **"Patrocinado"** é exibida pelo sistema
- Deve ficar **FORA da imagem**
- Não inserir essa informação no banner

---

### BOAS PRÁTICAS

- ✅ Usar imagem limpa e objetiva
- ✅ Evitar excesso de elementos
- ✅ Evitar textos pequenos ou ilegíveis
- ✅ Evitar bordas, molduras ou fundos quebrados
- ✅ Garantir que a imagem funcione mesmo cortada lateralmente

---

### RESUMO OPERACIONAL

| Regra | Status |
|---|---|
| 1600×200 px obrigatório | ✔ |
| Proporção 8:1 | ✔ |
| Imagem única e responsiva | ✔ |
| Foco central (segurança visual) | ✔ |
| Sem texto obrigatório na arte | ✔ |
| Clique em área total | ✔ |
| Dados do patrocinador via sistema | ✔ |
| "Patrocinado" fora da imagem | ✔ |
| Margens e espaçamento já definidos | ✔ |

---

> Este padrão não altera o funcionamento atual. Serve apenas para padronizar o uso correto pelos patrocinadores dentro do sistema.'
)
ON CONFLICT (slug) DO UPDATE SET
  content = EXCLUDED.content,
  title = EXCLUDED.title,
  meta_title = EXCLUDED.meta_title,
  meta_description = EXCLUDED.meta_description,
  updated_at = now();
