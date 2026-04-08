

# Correção de Perfis e Atribuição Automática de Nível/Tipo de Conta

## Contexto

- 3 perfis sem `level_id` nem `account_type_id`
- O trigger `handle_new_user()` atual não atribui `level_id` nem `account_type_id`
- IDs necessários:
  - `level_id` "Usuário" = `716c417b-fdc8-4121-879b-abcd8f0a216f`
  - `account_type_id` "Trial" = `50a97ea2-c43e-472f-b6f2-4dd180379cad`

## Plano

### 1. Corrigir os 3 perfis existentes (via insert tool — UPDATE)

Atualizar os 3 perfis que estão com `level_id` e `account_type_id` nulos:
- `eb5e6b5a-4bd5-4f4f-9673-0e3a41d318ab` (Leonardo)
- `5e388e94-4ead-4af4-abef-edc1c3062458` (Neto)
- `137a3865-f488-4c84-b660-bdb3d652487e` (Glenio)

Setar `level_id = '716c417b-...'` e `account_type_id = '50a97ea2-...'` para todos.

### 2. Atualizar o trigger `handle_new_user()` (via migração)

Modificar a função para incluir `level_id` e `account_type_id` no INSERT do perfil:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, level_id, account_type_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    '716c417b-fdc8-4121-879b-abcd8f0a216f',
    '50a97ea2-c43e-472f-b6f2-4dd180379cad'
  );
  RETURN NEW;
END;
$$;
```

Isso garante que todo novo cadastro receba automaticamente nível "Usuário" e tipo de conta "Trial".

### Resultado

- Os 3 perfis órfãos ficam corrigidos imediatamente
- Todo futuro cadastro (email ou OAuth) já nasce com nível e plano atribuídos
- Nenhuma alteração de código frontend necessária

