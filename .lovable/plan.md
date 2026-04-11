# Correção do Badge "Verificado" + Gestão Admin

## Problema

1. `**ProviderProfile.tsx` (linha 1008)** exibe "Perfil verificado" para TODOS os profissionais incondicionalmente — sem verificar nenhum critério.
2. `**ProviderCard.tsx**` tem lógica de verificação mas não exige CNPJ nem cidade.
3. **Não existe gestão administrativa** dedicada para as regras do badge verificado — as settings existem espalhadas na tabela `site_settings`, mas sem UI agrupada.

**Exemplo real:** "silvio-gon-alves" — sem cidade, sem CNPJ, sem foto, 0 álbuns — aparece como "Perfil verificado".

## Plano de Execução

### 1. Corrigir `ProviderProfile.tsx` — Aplicar mesma lógica de verificação

- Importar `useSettingValue` e `useFeatureEnabled`
- Replicar a lógica de `ProviderCard.tsx` para computar `isVerified` com base nas configurações do admin
- Adicionar novas regras: **CNPJ obrigatório** (`verified_badge_require_cnpj`) e **Cidade obrigatória** (`verified_badge_require_city`)
- Condicionar o badge "Perfil verificado" ao resultado da verificação
- Se não verificado mas com imagens, exibir "Perfil Completo" como fallback (mesmo padrão do Card)

### 2. Atualizar `ProviderCard.tsx` — Adicionar critérios CNPJ e Cidade

- Ler novas settings: `verified_badge_require_cnpj` e `verified_badge_require_city`
- Incluir na lógica `isVerified`: se `require_cnpj` estiver ativo, exigir `provider.cnpj` preenchido; se `require_city` ativo, exigir `provider.city` preenchido

### 3. Criar settings no banco (via insert)

- `verified_badge_require_cnpj` = `true`
- `verified_badge_require_city` = `true`

### 4. Criar seção administrativa dedicada — "Badge Verificado"

Adicionar uma seção visual no `AdminSettingsPage.tsx` (ou como aba no `AdminAccountTypesPage`) que agrupe todas as settings do badge verificado em um painel único:

- Toggle: Badge habilitado (`verified_badge_enabled`)
- Toggle: Exigir CNPJ (`verified_badge_require_cnpj`)
- Toggle: Exigir Cidade (`verified_badge_require_city`)
- Toggle: Exigir Foto (`verified_badge_require_photo`)
- Input numérico: Mínimo de serviços
- Input numérico: Mínimo de álbuns
- Input numérico: Mínimo de avaliações
- Input numérico: Nota mínima

Tudo gerenciável pelo admin, sem necessidade de código.

## Arquivos Modificados


| Arquivo                           | Alteração                                                      |
| --------------------------------- | -------------------------------------------------------------- |
| `src/pages/ProviderProfile.tsx`   | Aplicar lógica condicional ao badge "Perfil verificado"        |
| `src/components/ProviderCard.tsx` | Adicionar critérios CNPJ e cidade na verificação               |
| `src/pages/AdminSettingsPage.tsx` | Criar seção agrupada "Badge Verificado" com todos os controles |
| **Insert SQL**                    | 2 novas settings: `require_cnpj` e `require_city`              |


## O que NÃO será alterado

- Schema de tabelas (sem migrations — apenas inserts em `site_settings`)
- `client.ts`, `types.ts`, `.env`
- RLS policies existentes

..

&nbsp;

&nbsp;

Condições, criterios,  regras, lógica e etc devem ser gerenciáveis pelo painel administrativo 100%