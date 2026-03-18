

## Plano: Perfil como Landing Page Personalizavel

### Situacao Atual

O sistema possui dois fluxos separados:
- **Dashboard de edicao** (`/dashboard/perfil`, `/dashboard/servicos`): formularios para o profissional editar dados pessoais, profissionais, portfolio e servicos
- **Pagina publica** (`/profissional/:slug`): landing page fixa com layout padrao (header do perfil, sobre, portfolio, servicos, avaliacoes, sidebar de orcamento, WhatsApp flutuante)

O profissional nao tem controle sobre a ordem das secoes, cores, textos de destaque ou quais blocos aparecem na sua pagina publica.

### Proposta

Adicionar uma nova aba no dashboard ("Minha Pagina") que permite ao profissional personalizar o layout e conteudo da sua landing page, mantendo todas as funcionalidades existentes intactas.

### 1. Nova tabela `provider_page_settings`

Armazena as preferencias de personalizacao de cada profissional:

```sql
CREATE TABLE provider_page_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL UNIQUE REFERENCES providers(id) ON DELETE CASCADE,
  -- Ordem e visibilidade das secoes
  sections_order jsonb NOT NULL DEFAULT '["about","portfolio","services","reviews","lead_form"]',
  hidden_sections jsonb NOT NULL DEFAULT '[]',
  -- Textos personalizaveis
  headline text DEFAULT '',
  tagline text DEFAULT '',
  cta_text text DEFAULT 'Solicitar Orcamento',
  cta_whatsapp_text text DEFAULT 'Chamar no WhatsApp',
  -- Estilo
  accent_color text DEFAULT '',
  cover_image_url text DEFAULT '',
  -- Redes sociais
  instagram_url text DEFAULT '',
  facebook_url text DEFAULT '',
  youtube_url text DEFAULT '',
  tiktok_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

RLS: proprietario pode ler/editar; publico pode ler.

### 2. Nova pagina de dashboard: "Minha Pagina"

**Rota:** `/dashboard/minha-pagina`  
**Menu:** Adicionar item "Minha Pagina" com icone `Layout` no DashboardLayout entre "Meus Servicos" e "Leads".

**Funcionalidades da pagina:**
- **Imagem de capa**: upload para o bucket `portfolio` (subpasta `covers/`)
- **Headline e tagline**: campos de texto para frase de destaque e subtitulo
- **Textos dos botoes CTA**: personalizar texto do WhatsApp e do formulario de orcamento
- **Redes sociais**: campos para Instagram, Facebook, YouTube, TikTok
- **Cor de destaque**: seletor de cor (paleta predefinida de 8 cores)
- **Organizador de secoes**: lista drag-and-drop (ou botoes sobe/desce) para reordenar e toggle para mostrar/ocultar secoes (Sobre, Portfolio, Servicos, Avaliacoes, Formulario de Lead)
- **Preview inline**: botao "Ver minha pagina" que abre `/profissional/:slug` em nova aba

### 3. Evolucao da pagina publica (`/profissional/:slug`)

Modificar `ProviderProfile.tsx` para:
- Buscar `provider_page_settings` junto com os dados do provider
- Se existir `cover_image_url`, renderizar hero com imagem de fundo + overlay + nome/headline/tagline
- Renderizar secoes na ordem definida em `sections_order`, ocultando as que estiverem em `hidden_sections`
- Aplicar `accent_color` como CSS custom property (`--provider-accent`) para botoes e badges
- Exibir icones de redes sociais no header do perfil quando URLs estiverem preenchidas
- Usar `cta_text` e `cta_whatsapp_text` nos respectivos botoes
- Manter fallback padrao quando nao houver configuracoes salvas

### 4. Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar tabela `provider_page_settings` com RLS |
| `src/pages/DashboardMyPagePage.tsx` | **Criar** - editor de personalizacao |
| `src/components/DashboardLayout.tsx` | Adicionar item "Minha Pagina" ao menu |
| `src/pages/ProviderProfile.tsx` | Consumir `provider_page_settings` e renderizar dinamicamente |
| `src/App.tsx` | Adicionar rota `/dashboard/minha-pagina` |

### 5. Experiencia do usuario

- O profissional edita dados cadastrais em "Meu Perfil" (sem mudanca)
- O profissional gerencia servicos em "Meus Servicos" (sem mudanca)
- O profissional personaliza a aparencia da landing page em "Minha Pagina" (novo)
- Visitantes veem a landing page personalizada em `/profissional/:slug`
- Se o profissional nao personalizou nada, a pagina continua identica a atual (backward compatible)

### 6. Responsividade

- Hero com cover image: aspect-ratio adaptavel (16:9 desktop, 4:3 mobile)
- Editor de secoes: layout empilhado no mobile
- Seletor de cores: grid 4x2 em mobile

