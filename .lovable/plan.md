

## Estado Atual (já implementado)

| Requisito do prompt | Status no código |
|---|---|
| 1. Persistência (localStorage) | ✅ `STORAGE_KEY = 'onboarding_wizard_state'` salva step, profileType, city, state, fullName, selectedCategoryIds (linhas 60–101) |
| 2a. CityAutocomplete ativo | ✅ Step 2 renderiza `<CityAutocomplete>` quando `editingCity` ou sem cidade (linhas 446–469) |
| 2b. Categoria única | ✅ `handleToggleCategory` força array de 1 (linha 116) + `maxSelections={1}` |
| 3. Step 4 integrado + loop portfólio | ✅ Linhas 245–308: `<ServiceWizard>` injetado, "Novo serviço" / "Ver minha página" |
| 4. Bloqueio de saída | ✅ `onCancel` bloqueia se `servicesCreated === 0` (linhas 296–302) |
| 5. Smart Reset | ✅ `handleResetOnboarding` no DashboardPage limpa apenas profile_type/onboarding_completed |

## Refinamentos a aplicar (3 ajustes pequenos em 1 arquivo)

**Arquivo:** `src/components/onboarding/SmartOnboardingWizard.tsx`

### 1. Aviso "Especialidade principal" mais visível (Step 3)
Mover o texto de instrução para dentro de um card destacado **acima** do `SmartCategoryPicker`, com ícone e cor de alerta, em vez do `<p>` neutro atual (linha 511–513).

### 2. Barra de Nível de Confiança visível no Step 4
Adicionar barra de progresso no card de sucesso pós-serviço (linhas 263–286) que cresce conforme `servicesCreated`:
- 1 serviço = 60% (Iniciante consolidado)
- 2 serviços = 80% (Engajado)
- 3+ serviços = 100% (Portfólio Forte)
Reforça o gatilho psicológico do "Loop de Portfólio" pedido no item 3 do prompt.

### 3. Confirmação visual + scroll automático ao selecionar categoria
Quando o usuário selecionar a categoria, fazer scroll suave para o botão "Próximo" e aplicar pulse no botão (foco de ação) — atende ao "fechamento automático" pedido sem quebrar a UX de quem quer trocar de categoria.

## Fora de escopo

- Reset Inteligente: já preserva nome/telefone/cidade no banco (apenas zera flags). Sem mudanças.
- Persistência: já cobre 100% dos campos. Sem mudanças.
- Bloqueio de saída: já implementado. Sem mudanças.
- Step 1/2: sem mudanças.

## Resultado esperado

Funil idêntico ao já aprovado, com 3 melhorias de UX que reforçam o "Funil Imparável": aviso claro de escolha única, feedback visual de progresso no portfólio, e guia visual para o próximo clique.

