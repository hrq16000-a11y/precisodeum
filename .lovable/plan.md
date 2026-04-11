

# Página "Como Funciona" — Guia Completo da Plataforma

## Contexto

Já existem 3 páginas relacionadas:
- `/ajuda` — Central de Ajuda (FAQ com busca)
- `/faq` — Perguntas Frequentes (accordion)
- `/sobre` — Sobre prestação de serviço (conceito genérico)

Nenhuma delas explica **a plataforma em si**: como funciona, que é gratuita, o passo a passo para clientes e profissionais, com ilustrações visuais.

## Solução

Criar uma nova página `/como-funciona` rica e ilustrada, com seções visuais:

### Seções da Página

1. **Hero** — "Como funciona o Preciso de um?" com subtítulo e ilustração (ícones animados)
2. **Para Clientes** — 3 passos ilustrados (Buscar → Comparar → Contratar) com ícones grandes e animação sequencial
3. **Para Profissionais** — 3 passos (Cadastrar → Receber Leads → Crescer) mesmo padrão visual
4. **É Gratuito!** — Seção destacada explicando que não há custos para clientes, e que profissionais têm plano gratuito
5. **Diferenciais** — Grid com cards: Verificação, Avaliações, Geolocalização, Sem Intermediários, Chat Direto, Suporte
6. **FAQ Rápido** — 4-5 perguntas inline mais comuns (hardcoded ou puxando do banco)
7. **CTA Final** — Botões "Buscar Profissional" e "Cadastrar como Profissional"

### Recursos Visuais

- Ícones Lucide como ilustrações principais em containers coloridos (gradient)
- Animações framer-motion: fade-in escalonado, parallax sutil, counters
- Linha conectora animada entre os passos (padrão já usado no HowItWorksSection)
- Cards com glassmorphism leve e hover scale
- Badges coloridos por seção (azul = clientes, amarelo = profissionais, verde = gratuito)

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/ComoFuncionaPage.tsx` | Novo — página completa |
| `src/App.tsx` | Adicionar rota `/como-funciona` |

Sem mudanças de banco de dados. Conteúdo hardcoded (pode ser migrado para CMS depois).

