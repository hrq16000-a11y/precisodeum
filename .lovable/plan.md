

# Plano: Permitir Exclusão de Leads pelo Prestador

## Problema

1. **UI**: `DashboardLeadsPage.tsx` não tem botão de excluir — só mostra os leads sem ação de remoção.
2. **RLS**: A política de DELETE na tabela `leads` só permite admins (`has_role(auth.uid(), 'admin')`). Prestadores não conseguem excluir seus próprios leads.

## Correção

### 1. Migração: Adicionar política RLS para providers excluírem seus próprios leads

```sql
CREATE POLICY "Provider can delete own leads"
ON public.leads
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM providers
    WHERE providers.id = leads.provider_id
    AND providers.user_id = auth.uid()
  )
);
```

### 2. UI: Adicionar botão de excluir no DashboardLeadsPage

Em `src/pages/DashboardLeadsPage.tsx`:
- Importar `Trash2` do lucide-react e `toast` do sonner
- Adicionar função `handleDelete` que exclui o lead e atualiza a lista
- Adicionar botão de lixeira em cada card de lead (ao lado do botão WhatsApp)
- Animação de saída com framer-motion ao excluir

## Arquivos

| Arquivo | Alteração |
|---|---|
| Migração SQL | Nova política RLS para DELETE por provider |
| `src/pages/DashboardLeadsPage.tsx` | Botão de excluir + handler |

