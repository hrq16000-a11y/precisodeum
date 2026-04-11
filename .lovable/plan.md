

# Extração Inteligente de Texto — DashboardJobsPage

## Problema Atual

A função `parseSimpleText` é extremamente básica: extrai apenas título (primeira linha), cidade, salário e WhatsApp via regex simples. Não detecta categoria, tipo de contrato, modelo de trabalho, requisitos, atividades, benefícios, horário, bairro ou nome de contato. Resultado: o usuário cola um texto e quase nada é preenchido.

## Solução

Criar um parser inteligente que analisa texto livre e extrai todos os campos do formulário, incluindo auto-seleção de categoria por fuzzy match contra a base de categorias existente.

---

## Plano de Execução

### 1. Criar módulo `src/lib/jobTextParser.ts`

Parser dedicado com as seguintes capacidades:

**Extração por seções** — Detectar blocos como "Requisitos:", "Atividades:", "Benefícios:", "Horário:", "Sobre:", "Descrição:" e mapear para os campos corretos do formulário.

**Auto-detecção de categoria** — Receber a lista de categorias e fazer fuzzy match contra o texto completo (título + descrição). Ex: se o texto menciona "eletricista", selecionar automaticamente a categoria "Eletricista".

**Auto-detecção de cidade** — Detectar padrões como "Curitiba - PR", "São Paulo/SP", "Local: Maringá", além de buscar na base IBGE para validar.

**Detecção de tipo de contrato** — Keywords: "CLT", "PJ", "estágio", "temporário", "freelance", "meio período", "aprendiz" → mapear para `job_type`.

**Detecção de modelo de trabalho** — Keywords: "presencial", "remoto", "híbrido", "home office" → mapear para `work_model`.

**Detecção de contato** — Padrões de telefone/WhatsApp, nome de contato ("Contato:", "Falar com:").

**Salário inteligente** — "R$ 2.500", "a combinar", "de R$1.500 a R$3.000".

**Bairro** — "Bairro:", "região:", localização mais específica.

### 2. Atualizar `parseSimpleText` em DashboardJobsPage

- Substituir a função atual pela chamada ao novo parser
- Passar a lista de `categories` para o parser fazer o match
- Auto-selecionar `category_id` no form
- Auto-preencher `job_type` e `work_model`
- Preencher `activities`, `requirements`, `benefits`, `schedule`, `contact_name`, `neighborhood`
- Auto-preencher `citySearch` e validar contra IBGE

### 3. Feedback visual pós-extração

Ao clicar "Extrair dados e revisar", antes de ir para o modo estruturado:
- Mostrar um resumo rápido (toast ou inline) do que foi detectado: "✓ Categoria: Eletricista · ✓ Cidade: Curitiba, PR · ✓ CLT · ✓ Presencial"
- Campos não detectados ficam vazios para preenchimento manual
- Campos detectados ficam com highlight sutil (borda accent) para o usuário validar

### 4. Melhorar placeholder do textarea "Colar Texto"

Atualizar o placeholder para mostrar exemplos mais ricos que guiem o usuário a colar textos completos com seções.

---

## Arquivos Modificados

- **Novo**: `src/lib/jobTextParser.ts` — módulo de extração inteligente
- **Editado**: `src/pages/DashboardJobsPage.tsx` — integrar parser, feedback visual, melhorar UX

## O que NÃO será alterado

- GeoEngine, SIL, Governance Engine
- Tabela `jobs` (schema inalterado)
- `client.ts`, `types.ts`, `.env`

