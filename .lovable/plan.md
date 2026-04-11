

# Correção de Perfis Incompletos + Selo DESTAQUE + Avatar Gerado

## Problemas Identificados

1. **Perfil "jos-roberto-de-sousa-jr"** tem `plan = 'premium'` mas: sem nome, sem cidade, sem serviços, sem portfólio, sem foto — e aparece público com selo "DESTAQUE"
2. O selo **DESTAQUE** é baseado apenas em `provider.plan === 'premium'` — qualquer conta premium recebe, mesmo vazia
3. Avatares sem foto usam **iniciais** (ui-avatars.com) — usuário quer avatares visuais exclusivos, não iniciais
4. Perfis incompletos ficam visíveis publicamente sem alerta

## Solução em 5 Partes

### 1. Migration: Configurações de Governança no `site_settings`

Inserir novas chaves para controle administrativo:

```sql
-- Critérios para selo DESTAQUE (gerenciável pelo admin)
INSERT INTO site_settings (key, value, is_public) VALUES
  ('destaque_require_avatar', 'true', true),
  ('destaque_require_portfolio', 'true', true),
  ('destaque_require_services', 'true', true),
  ('destaque_min_services', '1', true),
  ('destaque_min_portfolio', '1', true),
  -- Perfil incompleto: prazo e política
  ('incomplete_profile_days_limit', '60', false),
  ('incomplete_profile_auto_delete', 'true', false),
  ('incomplete_profile_hide_public', 'true', true),
  -- Avatar gerado (não iniciais)
  ('avatar_fallback_style', 'adventurer', true)
ON CONFLICT (key) DO NOTHING;
```

### 2. Ocultar Perfis Incompletos da Listagem Pública

**Arquivos:** `src/hooks/useProviders.tsx`, `src/pages/ProviderProfile.tsx`

Definir "perfil completo mínimo" como: tem `full_name` preenchido + `city` preenchida. Perfis que não atendem:
- Ficam **ocultos** nas listagens públicas (filtro no query)
- Na página do perfil, mostram banner de alerta "Complete seu cadastro em X dias"

### 3. Selo DESTAQUE: Critérios Reais

**Arquivos:** `src/components/ProviderCard.tsx`, `src/pages/ProviderProfile.tsx`

Substituir `provider.plan === 'premium'` por verificação real baseada nas configs:
- Tem foto/avatar próprio (não gerado)
- Tem pelo menos 1 serviço cadastrado
- Tem pelo menos 1 item no portfólio
- Tudo lido das `site_settings` (gerenciável pelo admin)

### 4. Avatar Gerado Exclusivo (sem iniciais)

**Arquivos:** `src/components/ProviderCard.tsx`, `src/pages/ProviderProfile.tsx`

Substituir `ui-avatars.com` por [DiceBear API](https://api.dicebear.com) com estilo configurável:
```
https://api.dicebear.com/9.x/{style}/svg?seed={userId}
```
O estilo (`adventurer`, `bottts`, `fun-emoji`, etc.) é gerenciável via `avatar_fallback_style` no admin.

### 5. Alerta no Dashboard + Exclusão Automática (60 dias)

**Arquivo:** `src/components/DashboardLayout.tsx` ou `DashboardPage.tsx`

- Banner persistente no dashboard: "Complete seu cadastro. Você tem X dias restantes antes da exclusão."
- **Migration SQL**: Criar função `pg_cron` ou trigger que soft-delete providers com mais de 60 dias sem dados mínimos preenchidos

### 6. Painel Admin: Seção de Governança de Perfis

**Arquivo:** `src/pages/AdminSettingsPage.tsx`

Nova seção "Regras de Perfil" com:
- Toggle: ocultar perfis incompletos
- Dias limite para completar cadastro
- Toggle: exclusão automática
- Critérios do selo DESTAQUE (avatar, portfólio, serviços, mínimos)
- Estilo do avatar fallback (dropdown com opções DiceBear)

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| Migration SQL | Novas settings + trigger de limpeza automática |
| `src/hooks/useProviders.tsx` | Filtrar perfis incompletos das listagens |
| `src/pages/ProviderProfile.tsx` | Banner alerta + avatar DiceBear + selo DESTAQUE real |
| `src/components/ProviderCard.tsx` | Avatar DiceBear + selo DESTAQUE por critérios |
| `src/pages/AdminSettingsPage.tsx` | Seção "Regras de Perfil" gerenciável |
| `src/components/DashboardLayout.tsx` | Banner de alerta para perfis incompletos |

