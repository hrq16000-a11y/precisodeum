## Cadastro Inteligente + Mural Realtime

### 1. Infraestrutura (DB + libs)

**Instalar**: `canvas-confetti` + `@types/canvas-confetti`

**Migration SQL**:

```sql
CREATE TABLE public.public_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_alias text NOT NULL,        -- "Mestre H.", "Eletricista de Curitiba"
  action_text text NOT NULL,        -- "acaba de se cadastrar"
  icon text DEFAULT 'Sparkles',     -- Lucide PascalCase
  city text,
  profile_type text,                -- 'provider' | 'rh' | 'client'
  category_name text,
  is_seed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.public_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads activities" ON public.public_activities FOR SELECT USING (true);
CREATE POLICY "system inserts activities" ON public.public_activities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_activities;
ALTER TABLE public.public_activities REPLICA IDENTITY FULL;

-- RPC mural híbrido
CREATE OR REPLACE FUNCTION public.get_community_feed(_limit int DEFAULT 10)
RETURNS SETOF public.public_activities
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_real int;
BEGIN
  SELECT count(*) INTO v_real FROM public.public_activities
   WHERE is_seed=false AND created_at > now() - interval '7 days';
  IF v_real >= _limit THEN
    RETURN QUERY SELECT * FROM public.public_activities
      WHERE is_seed=false ORDER BY created_at DESC LIMIT _limit;
  ELSE
    RETURN QUERY
      (SELECT * FROM public.public_activities WHERE is_seed=false ORDER BY created_at DESC LIMIT v_real)
      UNION ALL
      (SELECT * FROM public.public_activities WHERE is_seed=true ORDER BY random() LIMIT (_limit - v_real));
  END IF;
END $$;
```

**Seed**: ~25 atividades fake variadas (eletricista/encanador/pintor) em capitais.

### 2. Novo Wizard "Mestre de Obras"

Substituir `ProfileTypeChooser.tsx` por `SmartOnboardingWizard.tsx` (3 passos):

- **Step 1 — Identidade**: 2 botões gigantes  
`[Sou Autônomo]` (provider) · `[Sou Empresa/RH]` (rh)  
*(Cliente fica acessível como link discreto "Só quero contratar")*
- **Step 2 — Geo Silenciosa**: chama `useGeoCity()` → "Vimos que você está em **{cidade}**. Correto?" `[SIM]` `[Outra cidade]` (input fallback).
- **Step 3 — Gancho**: Nome completo + `SmartCategoryPicker` (categoria principal). Badge "+20 pontos de confiança".

**Persistência (atomic, evita user_id missing)**:

1. `UPDATE profiles SET profile_type, full_name, role`
2. `auth.updateUser({ data: { profile_type_chosen: true }})`
3. Se provider/rh: `INSERT INTO providers (user_id, slug, city, state, category_id, status)` — **aguardar retornar** `id` antes de prosseguir.
4. `INSERT INTO public_activities` (actor_alias = "Mestre " + primeira letra do nome, city, category).
5. `await refetchProfile()` → confeti → redirect.

### 3. Festa + Redirecionamento

```ts
import confetti from 'canvas-confetti';
confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }});
toast.success('Parabéns, Mestre! Você já está na vitrine.');
```

Redirect:

- provider → `/dashboard?wizard=1` (abre ServiceWizard)
- rh → `/dashboard/vagas?new=1`
- client → `/`

### 4. CommunityFeed Realtime

Atualizar `src/components/dashboard/CommunityFeed.tsx`:

- Trocar query `audit_log` por `supabase.rpc('get_community_feed', { _limit: 10 })`.
- Subscribe `postgres_changes` em `public_activities` → prepend novo item com animação framer-motion (slide-in + balão flutuante 4s).
- Renderizar texto dinâmico: `"{icon} {actor_alias} {action_text} em {city}"`.

**Injeção**:

- `src/pages/Index.tsx`: adicionar abaixo do `<HeroBanner />`.
- `src/pages/DashboardPage.tsx`: já existe — só substituir versão.

### 5. Segurança & Correções

- Wizard usa `try/finally` com `setSaving`; botão desabilitado durante saves.
- Validação: bloquear Step 3 se `user.id` for null (re-fetch session).
- `TypeSelectionGate` em `App.tsx` passa a renderizar `SmartOnboardingWizard` em vez de `ProfileTypeChooser`.
- Manter `ProfileTypeChooser.tsx` como deprecated (deletar após validação).

### Arquivos afetados

- **Novo**: `src/components/onboarding/SmartOnboardingWizard.tsx`, migration SQL
- **Editado**: `App.tsx`, `CommunityFeed.tsx`, `Index.tsx`, `package.json`
- **Deletado**: `ProfileTypeChooser.tsx` (após swap)

&nbsp;

Tenho apenas dois aditivos pequenos, mas que fazem toda a diferença para o "Mestre de 70 anos" e para a credibilidade do mural:

1. Ícone Dinâmico no Mural (Aditivo de UX)

No plano, o icon está como DEFAULT 'Sparkles'. Para ficar realmente lúdico e profissional:

Aditivo: Peça ao Lovable que, ao gravar a atividade no Step 3, o sistema escolha o ícone baseado na categoria selecionada (Ex: se escolheu Pintor, grava um ícone de Palette; se Pedreiro, Hammer). Isso visualmente "vende" muito mais a prova social no mural.

2. O Indicador "AO VIVO" (Aditivo de Prova Social)

Para reforçar que o mural é "Realtime", um detalhe visual ajuda muito.

Aditivo: No componente CommunityFeed.tsx, adicione uma pequena luz verde pulsante (badge) com o texto "AO VIVO" ou "AGORA". Isso dá o gatilho de urgência para quem está olhando, mostrando que a plataforma está fervendo naquele exato momento.

🛠️ Ajuste sugerido no Step 2 (Persistência)

Para garantir que o senhor de 70 anos não fique travado caso a internet dele oscile no 3G bem na hora do "Salvar":

Aditivo: Solicite um Loading Overlay (um "Carregando" em tela cheia) com uma frase amigável enquanto o banco processa, tipo: "Segura as ferramentas, Mestre! Estamos preparando seu espaço...". Isso evita que ele clique duas vezes no botão e gere erro.