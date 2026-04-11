

# Sistema de Suporte/Ajuda + WhatsApp no Card + Reformulação do Perfil

## 1. Desativar WhatsApp flutuante na Home

**Arquivo:** `src/pages/Index.tsx`, `Index02.tsx`, `Index03.tsx`
- Remover `<FloatingWhatsApp />` das 3 páginas Index (o componente continua existindo mas não aparece mais na home)

## 2. Botão WhatsApp no Card do Prestador

**Arquivo:** `src/components/ProviderCard.tsx`
- O card **já tem** o botão WhatsApp integrado (linhas 160-170) com ícone `MessageCircle` e link correto
- Ajustar a cor do ícone WhatsApp para o verde oficial `#25D366` (mesmo verde do logo) conforme feedback do usuário
- Adicionar ícone SVG do WhatsApp real ao invés do `MessageCircle` genérico

## 3. WhatsApp flutuante na página do Prestador

**Arquivo:** `src/pages/ProviderProfile.tsx`
- Adicionar `<FloatingWhatsApp />` (ou botão direto) usando o WhatsApp **do prestador** (não o de suporte)
- Cor do botão: `#25D366` (verde oficial do WhatsApp, igual ao logo)
- Posição alinhada com a barra inferior mobile

## 4. Criar página de Central de Ajuda (`/ajuda`)

**Novo arquivo:** `src/pages/HelpCenterPage.tsx`
- Página pública com busca + FAQs organizados por categoria
- Seções: "Para Clientes", "Para Profissionais", "Planos e Pagamentos", "Conta e Segurança"
- Puxa dados da tabela `faqs` existente (já tem dados e admin em `/admin/faq`)
- Link de contato via WhatsApp de suporte (do `site_settings`)
- SEO configurado

**Rota:** Adicionar em `App.tsx` → `/ajuda`

## 5. Botão flutuante de Suporte/Ajuda

**Novo arquivo:** `src/components/FloatingHelpButton.tsx`
- Ícone: `HelpCircle` ou `LifeBuoy` do Lucide
- Aparece em: `/login`, `/cadastro`, `/reset-password`, `/dashboard/*`
- NÃO aparece em: `/admin`, `/sponsor-panel`, home pública
- Ao clicar: abre mini-painel com 3 opções:
  - "Central de Ajuda" → navega para `/ajuda`
  - "Perguntas Frequentes" → navega para `/faq`
  - "Falar com Suporte" → WhatsApp de suporte (do `site_settings`)
- Animação sutil com framer-motion
- Posição: canto inferior direito, acima da barra mobile

## 6. Dashboard: link de Suporte no menu

**Arquivo:** `src/components/DashboardLayout.tsx`
- Adicionar item "Ajuda & Suporte" no menu lateral/grupo do dashboard
- Link para `/ajuda`

## 7. Reformulação do "Meu Perfil" (`DashboardProfilePage.tsx`)

**Arquivo:** `src/pages/DashboardProfilePage.tsx`
- **Barra de completude** no topo: progresso visual (0-100%) mostrando campos preenchidos
- **Organização em abas** (ou acordeão expansível): "Dados Pessoais" | "Dados Profissionais" | "Localização" | "Redes Sociais"
- **Dica contextual**: link "Precisa de ajuda?" no topo → `/ajuda`
- **Preview do perfil público**: mini-card mostrando como o perfil aparece para visitantes
- **Animações framer-motion**: fade-in nos blocos, transição entre abas
- Manter toda a lógica de salvamento existente

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| `src/pages/Index.tsx` | Remover FloatingWhatsApp |
| `src/pages/Index02.tsx` | Remover FloatingWhatsApp |
| `src/pages/Index03.tsx` | Remover FloatingWhatsApp |
| `src/components/ProviderCard.tsx` | Ícone WhatsApp real + cor #25D366 |
| `src/pages/ProviderProfile.tsx` | Adicionar WhatsApp flutuante do prestador |
| `src/components/FloatingHelpButton.tsx` | **Novo** — botão flutuante de suporte |
| `src/pages/HelpCenterPage.tsx` | **Novo** — Central de Ajuda |
| `src/App.tsx` | Rota `/ajuda` |
| `src/components/DashboardLayout.tsx` | Link "Ajuda" no menu |
| `src/pages/DashboardProfilePage.tsx` | Reformulação com abas, barra de completude, preview |

Nenhuma migration necessária — usa tabela `faqs` e `site_settings` existentes.

