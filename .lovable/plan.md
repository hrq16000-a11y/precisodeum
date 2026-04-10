

## Correções de Validação e Robustez no Cadastro

### Arquivo: `src/pages/SignupPage.tsx`

**1. "Outro" salva em campo separado**
- Adicionar `categoryCustom` ao form state
- Quando "Outro" for selecionado, salvar texto em `categoryCustom` (não em `categoryId`)
- No submit, enviar `category_custom` separado no insert do provider

**2. Categoria obrigatória**
- Validar no submit: `categoryId` OU `categoryCustom` deve existir
- Toast de erro se nenhum preenchido

**3. Cidade validada obrigatória**
- Bloquear submit se `form.city` ou `form.state` estiverem vazios
- Impedir digitação livre sem seleção (limpar city/state se input mudar após seleção)

**4. Fallback GPS**
- Já existe tratamento de erro no `handleAutoLocate` — apenas garantir que o toast de erro não trava o fluxo (já OK, mas remover `return` desnecessário)

**5. Garantir lat/lon no submit**
- Se `latitude`/`longitude` forem `null` mas `city`/`state` existem → chamar `geocodeCity()` antes de inserir

**6. Sanitizar CNPJ**
- Já faz `form.cnpj.replace(/\D/g, '')` no submit — OK
- Adicionar validação: se preenchido, deve ter exatamente 14 dígitos

**7. Vínculo user_ref**
- O trigger `copy_user_ref_from_profile` já copia `user_ref` do profile para provider via `user_id` — OK, nenhuma mudança necessária

**8. Prevenir duplicidade no submit**
- Desabilitar botão com `loading` (já faz `disabled={loading}`)
- Adicionar `loading` state visual com spinner no botão

**9. Validar telefone mínimo**
- No submit, validar `form.phone.length >= 10` antes de prosseguir

### Arquivo: Migração SQL
- Adicionar coluna `category_custom TEXT DEFAULT NULL` na tabela `providers`

### Resumo das mudanças
| Correção | Arquivo |
|---|---|
| Campo `category_custom` no DB | Migração SQL |
| Validações no submit (categoria, cidade, telefone, CNPJ, lat/lon) | `SignupPage.tsx` |
| Separar "Outro" de `categoryId` | `SignupPage.tsx` |
| Loading spinner no botão | `SignupPage.tsx` |

