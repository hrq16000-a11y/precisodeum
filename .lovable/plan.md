
## Estado atual (verificado no código)

- **Phase4Review já não é renderizada** — `OnboardingV2Shell.tsx` linha 1480 trata `phase4_review` como passagem silenciosa: grava `recordRegistrationSnapshotOnce` e despacha `NEXT` direto pra `done`. A fase ainda existe em `state.ts`/`types.ts` como nó intermediário, mas sem UI.
- **`registration_snapshots`** existe com colunas para IP, ISP, lat/lng, endereço, device, UTMs etc. e a página `/dashboard/meu-cadastro` já consome todas elas.
- **`working_hours_struct` (jsonb)** + flags derivadas `opens_weekend`, `opens_late_night`, `opens_overnight`, `is_24h` já existem em `providers` e `services` (migration `20260501055114_…`) com trigger de derivação. Já são selecionadas em `useProviders.tsx` e `ProviderProfile.tsx`.
- **`WorkingHoursPicker`** já tem presets (Comercial / Estendido / 24h / Fim de semana / Sob agendamento) + faixas customizadas com `validateStruct` (overlap, duplicate, fim<início, dias vazios), limite `MAX_RANGES`.
- **`/buscar`** ainda **NÃO** tem filtros de fim de semana / madrugada / noite / 24h / "aberto agora" / "sob agendamento". `applySearchFilters` não recebe esses flags.

Portanto: estrutura de dados está pronta. Falta (1) blindar imutabilidade no banco, (2) faltam três campos no snapshot exibidos na página, (3) faltam filtros derivados e ordenação "aberto agora" na busca, (4) limpar a fase fantasma `phase4_review`.

## Mudanças propostas

### 1. Wizard silencioso — limpeza final
- Remover `phase4_review` de `PHASE_ORDER` (`state.ts`) e do tipo `OnboardingPhase` (`types.ts`).
- No `OnboardingV2Shell`, mover o `recordRegistrationSnapshotOnce` para o `case 'phase4_extras_b'` (último step antes de `done`) — mantém telemetria `submit` e elimina a fase intermediária morta.
- Apagar `Phase4Review.tsx`, `validateReviewData.ts`, `reviewSectionMap.ts`, `useFocusFieldFromReview.ts` (não referenciados após a remoção).
- Atualizar `VISIBLE_PHASES_COUNT` e qualquer `switch` que ainda referencie `phase4_review`.

### 2. Imutabilidade do "cadastro morto" (DB)
Migration nova:
- `registration_snapshots`: revogar UPDATE/DELETE de `authenticated`/`anon` e adicionar trigger `BEFORE UPDATE OR DELETE` que faz `RAISE EXCEPTION 'registration_snapshots is immutable'` (admin SQL ainda passa por bypass via `current_setting('app.allow_snapshot_admin_override', true)` opcional — manter raise por padrão).
- Garantir RLS:
  - SELECT: `user_id = auth.uid()` OR admin via `has_role`.
  - INSERT: `user_id = auth.uid()` apenas se ainda não existir snapshot (constraint `UNIQUE(user_id)`).
  - UPDATE/DELETE: bloqueados pela trigger acima.
- `request_self_account_ban` permanece como porta única para "deletar"; trigger não bloqueia ele porque ele só altera `profiles`/agenda exclusão, sem tocar no snapshot.

### 3. Página `/dashboard/meu-cadastro` — exibir o que falta
Já mostra todos os campos relevantes. Verificar que aparece também (todos já existentes nas colunas):
- IP + ISP + país/região/cidade GeoIP — **OK**.
- Lat/Lng + accuracy + movimento — **OK**.
- Endereço completo (CEP, rua, número, bairro, cidade, UF) — **OK**.
- Provedor de signup (Google/email/social/anúncio) via `signup_method`, `signup_referrer`, UTMs e `came_from_link` — **OK**.

Adições:
- Mostrar coluna **`auth_provider`** (google/email/facebook…) lendo de `auth.users.app_metadata.provider`. Adicionar campo derivado no insert do snapshot via `recordRegistrationSnapshotOnce` (lendo `supabase.auth.getUser()` → `app_metadata.provider`).
- Adicionar selo "IMUTÁVEL" e a data de captura no topo (já temos `captured_at`).
- Pequena nota legal: "Este registro é imutável por trigger de banco — qualquer tentativa de alteração é negada e auditada."

### 4. Horários — modelo consultável (já existe, formalizar)
Não precisa mudar schema. Validar que:
- Trigger `BEFORE INSERT OR UPDATE OF working_hours_struct` deriva e popula `opens_weekend / opens_late_night / opens_overnight / is_24h`.
- Adicionar campo derivado **`accepts_on_demand`** boolean no mesmo trigger (true quando `ranges` está vazio ou preset = `on_demand`). Migration curta.
- Backfill: rodar UPDATE em todos os providers/services para reaplicar derivação (basta um `UPDATE … SET working_hours_struct = working_hours_struct`).

### 5. Filtros derivados e "aberto agora" no `/buscar`
**`searchFilters.ts`** — estender `FilterableProvider` e `SearchFilterOptions`:
```ts
opensWeekend?: boolean;
opensLateNight?: boolean;
opensOvernight?: boolean;
is24h?: boolean;
acceptsOnDemand?: boolean;
workingHoursStruct?: WorkingHoursStruct | null;
```
Novos opts: `weekendOnly`, `lateNightOnly` (após 20h), `overnightOnly` (00–06h), `is24hOnly`, `onDemandOnly`, `openNowOnly`.

Filtragem:
- Para flags simples: filtra por boolean direto.
- Para "aberto agora": função pura `isOpenNow(struct, now=new Date())` que respeita faixas cruzando meia-noite. Coloca em `src/lib/workingHoursOpenNow.ts` com testes Vitest (matriz: comercial às 12h ✓, comercial às 22h ✗, faixa 22→06 às 02h ✓, on_demand → null/false).
- Boost "aberto agora primeiro" mesmo sem o filtro ativo: stable partition igual ao `online_first`, opt-in via `prioritizeOpenNow`.

**`SearchPage.tsx`** — UI:
- Novos chips no drawer de filtros: "Fim de semana", "Após 20h", "Madrugada (00–06h)", "24h", "Sob agendamento", "Aberto agora".
- Persistir em URL: `?fds=1&noite=1&madrugada=1&h24=1&agendamento=1&aberto=1`.
- Adicionar `'open_now'` em `SortOption` + chip "Aberto agora" no `SORT_CHIPS`.
- `useProviders.tsx` já seleciona as flags; adicionar `accepts_on_demand` ao `providerSelect` e mapear para `acceptsOnDemand`.
- `countActiveFilters` precisa contar os novos.

### 6. Bairro de exibição do horário no perfil público
`WorkingHoursDisplay.tsx` já existe e é consumido no `ProviderProfile`. Conferir que renderiza o badge "Aberto agora" usando a mesma `isOpenNow` (DRY) — refatorar para importar a função pura.

## Detalhes técnicos

**Arquivos a criar**
- `supabase/migrations/{ts}_immutable_registration_snapshots.sql`
- `supabase/migrations/{ts}_accepts_on_demand_flag.sql`
- `src/lib/workingHoursOpenNow.ts` + `src/lib/__tests__/workingHoursOpenNow.test.ts`

**Arquivos a editar**
- `src/components/onboarding/wizard/phases/v2/{state.ts,types.ts,OnboardingV2Shell.tsx}` — remover `phase4_review`, mover snapshot para `phase4_extras_b`.
- `src/components/onboarding/wizard/phases/v2/Phase4Review.tsx` — **deletar**.
- `src/lib/registrationSnapshot.ts` — capturar `auth_provider`.
- `src/pages/DashboardMyRegistrationPage.tsx` — exibir `auth_provider` + nota de imutabilidade.
- `src/lib/searchFilters.ts` — novos flags + filtros + boost open-now.
- `src/pages/SearchPage.tsx` — chips de UI + URL state + sort.
- `src/hooks/useProviders.tsx` — incluir `accepts_on_demand`.
- `src/components/profile/WorkingHoursDisplay.tsx` — usar `isOpenNow` central.

**Riscos e mitigações**
- Trigger imutável pode quebrar testes que tentem UPDATE — adicionar exceção via `SET LOCAL app.allow_snapshot_admin_override = 'on'` em casos administrativos extremos (não exposto ao client).
- Renomear/remover `phase4_review` exige varrer todo `OnboardingV2Shell` (linhas 525, 581, 1480) e `state.ts` (linha 31). Se algum draft remoto persistido tem `phase: 'phase4_review'`, mapear para `phase4_extras_b` no `HYDRATE`.
- "Aberto agora" depende do timezone do cliente; documentar que usa `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` para consistência.

**Fora de escopo (já feito ou independente)**
- Sugestão de cidades por proximidade da cidade-base (já implementado no `useNearbyCitySuggestions`).
- Detecção de RM Curitiba a partir de cidade-membro (`findMetroForCity` já existe).
- `InstallAppCard` no fim do wizard (já presente em `Phase3Celebration` e `WizardShell`).
