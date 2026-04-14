

## Plano: Corrigir 2 Bugs Reportados

### Bug 1: Erro "st_makepoint does not exist" ao Salvar Perfil

**Causa raiz**: O trigger `trg_sync_provider_geog` chama a função `sync_provider_geog()` que usa `ST_MakePoint()`. Essa função PostGIS vive no schema `extensions`, mas a function tem `search_path=public` — não encontra `ST_MakePoint`.

**Correção**: Migração SQL para recriar a função com `search_path = public, extensions`:

```sql
CREATE OR REPLACE FUNCTION sync_provider_geog()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326)::geography;
  ELSE
    NEW.geog := NULL;
  END IF;
  RETURN NEW;
END;
$$;
```

Mesma correção para `sync_demand_log_geog()` que tem o mesmo padrão.

---

### Bug 2: "Sem nome" nos Prestadores Aguardando (Admin Overview)

**Causa raiz**: O admin overview (`AdminPage.tsx`) mostra `p.business_name || 'Sem nome'`, mas os providers pendentes não têm `business_name` preenchido — os nomes estão na tabela `profiles.full_name`.

**Correção**: Na query de pendentes no `AdminPage.tsx`, fazer JOIN com `profiles` para pegar `full_name`, e exibir `profiles.full_name || business_name || 'Sem nome'`.

---

### Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/` | Nova migração: fix search_path das 2 functions geográficas |
| `src/pages/AdminPage.tsx` | Corrigir query de pendentes para incluir `profiles.full_name` |

### Sobre as Fases 1 e 2

Sim, as Fases 1 e 2 da unificação do CRM foram implementadas com sucesso:
- Abas "Usuários" e "Métricas" unificadas na `AdminUsersPage`
- KPIs reais calculados do banco (Total, Novos 30d, Ativos, Suspensos/Banidos)
- Filtros corrigidos com `suspended` e `banned`
- CRM redirecionado para a tela unificada

Os tipos de conta, níveis, planos, regras e recursos continuam 100% funcionais e gerenciáveis pelo admin. Estes 2 bugs são isolados e não afetam a arquitetura de gestão.

