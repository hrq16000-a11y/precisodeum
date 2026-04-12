

# Corrigir Aprovação Automática de Prestadores

## Problema
Dois problemas encontrados:

1. **Trigger inexistente**: Não existe nenhum trigger na tabela `providers`. O trigger `auto_approve_provider_trigger` nunca foi criado no banco de dados real.
2. **Tabela errada**: A função `auto_approve_provider()` consulta a tabela `governance_rules`, mas a configuração está salva na tabela `site_settings` (onde `auto_approve_providers = 'true'`).

## Solução
Criar uma migração SQL que:

1. **Corrige a função** `auto_approve_provider()` para consultar `site_settings` em vez de `governance_rules`
2. **Recria o trigger** `auto_approve_provider_trigger` na tabela `providers` (BEFORE INSERT)
3. Mantém as validações de cidade/estado já existentes

## Migração SQL

```sql
CREATE OR REPLACE FUNCTION public.auto_approve_provider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  should_auto boolean;
BEGIN
  SELECT (value = 'true') INTO should_auto
  FROM public.site_settings
  WHERE key = 'auto_approve_providers'
  LIMIT 1;

  IF should_auto IS TRUE
     AND NEW.status = 'pending'
     AND COALESCE(NEW.city, '') <> ''
     AND NEW.city <> 'Não informada'
     AND COALESCE(NEW.state, '') <> ''
  THEN
    NEW.status := 'approved';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER auto_approve_provider_trigger
  BEFORE INSERT ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.auto_approve_provider();
```

## Resultado
- Toggle no painel admin (`site_settings.auto_approve_providers`) passa a funcionar
- Novos prestadores com cidade/estado preenchidos são aprovados automaticamente
- Nenhuma alteração de código frontend necessária

