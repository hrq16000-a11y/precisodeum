

## Correção: Redirecionar usuário autenticado na página de cadastro

### Problema
Quando o usuário clica "Cadastrar com Google" na página de cadastro e já tem conta, o OAuth completa com sucesso mas o usuário permanece na tela de cadastro. Isso acontece porque:
1. A `SignupPage` não verifica se o usuário já está autenticado após o retorno do OAuth
2. O `OAuthRedirectHandler` só redireciona se houver uma URL salva em `sessionStorage`, mas a signup page não salva nenhuma

### Solução
Adicionar um `useEffect` na `SignupPage` que detecta quando o usuário está autenticado e redireciona automaticamente para o dashboard apropriado (baseado no `profile_type`).

### Arquivo editado
**`src/pages/SignupPage.tsx`**
- Importar `useAuth` 
- Adicionar `useEffect` que observa `user` e `loading` do auth context
- Quando detectar usuário autenticado, consultar `profile_type` e redirecionar:
  - `client` → `/`
  - `rh` → `/dashboard/vagas`
  - Outros → `/dashboard/servicos`

Mesma lógica de redirecionamento já usada no `LoginPage.getRedirectForProfile()`.

