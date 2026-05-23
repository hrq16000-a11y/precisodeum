# FASE 2.4 — SPONSOR SELF-SERVICE FOUNDATION

Autonomia controlada para patrocinadores operarem o básico da campanha sem depender do admin para mudanças simples. Tudo fail-closed, approval-based, auditável.

---

## Etapa 1 — Auditoria prévia (READ-ONLY, antes de codar)

Verificar e mapear:

- `sponsors` (colunas editáveis vs sensíveis)
- `sponsor_contacts`, `sponsor_subscriptions`, `sponsor_assets` (bucket privado)
- `SponsorStatusPage`, `SponsorPublicPage`, `SponsorContractPage`, `SponsorNotificationsPage`, `SponsorDashboardPage`
- RLS atual em `sponsors` e buckets
- Pipeline de upload existente (reaproveitar `sponsor_assets` + edge function de upload)
- `audit_log` (formato dos `resource_type` já em uso)

Resultado da auditoria documentado no commit message + memória (`.lovable/memory/funcionalidades/patrocinadores/self-service-fase-2-4.md`).

---

## Etapa 2 — Escopo self-service (campos liberados)

**Liberado em draft (vai para aprovação):**

- `image_url` (banner)
- `logo_url`
- `link_url` (CTA)
- `phone` / `whatsapp`
- `description` curta
- `city` / `category` (marcados como `sensitive=true`)
- `renewal_requested` (boolean)

**Bloqueado (sempre admin):**

- `tier`, `position`, `display_order`, `active`, `start_date`, `end_date`
- billing, slot premium, pacing, prioridade
- qualquer coluna de inventory

---

## Etapa 3 — Draft system + approval flow (DB)

Nova tabela `sponsor_change_requests`:

```text
id uuid pk
sponsor_id uuid → sponsors
requested_by uuid → auth.users
status text: pending | approved | rejected | cancelled
changes jsonb (apenas campos da whitelist)
admin_comment text
reviewed_by uuid
reviewed_at timestamptz
created_at, updated_at
```

RPCs (security definer, fail-closed):

- `sponsor_submit_change_request(_sponsor_id, _changes jsonb)` — valida whitelist server-side + ownership via `sponsor_contacts`, rejeita campos fora da whitelist, audita.
- `sponsor_cancel_change_request(_id)` — só o próprio sponsor enquanto `pending`.
- `admin_review_sponsor_change_request(_id, _decision, _comment)` — aplica diffs em `sponsors` quando approved; tudo em `audit_log` (`resource_type='sponsor_change_request'`).

RLS:

- Sponsor lê/cria suas próprias requests.
- Admin lê todas e revisa.

---

## Etapa 4 — Creative management (uploads)

Reutiliza `sponsor_assets` (bucket privado já existente).

- Upload via componente já existente do projeto; URL pública resultante entra no `changes.image_url` / `changes.logo_url` da request (não aplica direto em `sponsors`).
- Validação client: tipo (image/jpeg|png|webp), tamanho ≤ 2MB, dimensão mínima (banner 800×200, logo 256×256).
- Sem cropper, sem editor.

---

## Etapa 5 — UI Sponsor

Novos componentes/páginas:

- `src/pages/sponsor/SponsorSelfServicePage.tsx` — rota `/sponsor-panel/editar`:
  - Formulário com os campos da whitelist (zod)
  - Botão "Solicitar alteração" → cria request
  - Painel "Pendências" lista requests `pending` com botão cancelar
  - Histórico das últimas 10 (aprovadas/rejeitadas/comentários)
  - Botão "Solicitar renovação" (request com `changes={renewal_requested:true}`)
- `SponsorAlertsCard.tsx` em `SponsorDashboardPage`:
  - Campanha expira em ≤7d
  - Banner/logo ausente
  - Pacing crítico (reaproveita `sponsor_metrics`)
  - Pendências aguardando aprovação admin
- Link "Editar campanha" no menu sponsor.

---

## Etapa 6 — UI Admin

`src/pages/AdminSponsorChangeRequestsPage.tsx` (rota `/admin/sponsor-change-requests`):

- Lista paginada de requests `pending`
- Diff visual (antes/depois) por campo
- Botões aprovar / rejeitar (com comentário)
- Filtro por status + sponsor
- Item no `AdminLayout` grupo "Comercial"

---

## Etapa 7 — Segurança & testes

- RLS testada: sponsor não consegue editar `sponsors` direto, só via RPC.
- RPC rejeita chaves fora da whitelist com `raise exception`.
- Notificação para admin via `notifications` ao criar request; sponsor recebe notificação ao ser aprovada/rejeitada.
- Testes Vitest:
  - `sponsor-change-request-whitelist.test.ts` — campos fora da whitelist rejeitados.
  - `sponsor-change-request-ownership.test.ts` — sponsor A não cria request para sponsor B.
  - `sponsor-self-service-form.test.tsx` — submit cria payload válido.

---

## Etapa 8 — Performance

- Sem realtime, sem polling.
- Queries simples (`select` com filtro + limit 20).
- Lazy import da página `SponsorSelfServicePage` e `AdminSponsorChangeRequestsPage` no `App.tsx`.

---

## Etapa 9 — Auditoria final + entregáveis

Doc em `.lovable/memory/funcionalidades/patrocinadores/self-service-fase-2-4.md` com:

- Escopo liberado
- Fluxo draft/approval
- Evidências de segurança (RLS, whitelist server-side)
- Performance impact
- Dependências manuais restantes (billing, tier, slots)
- Maturidade: **Operacional** (self-service para criativos/contato; admin ainda dono de billing/inventory)
- Próximo gargalo recomendado

---

## Próxima fase recomendada (justificada)

**Sponsor Billing Layer** — agora que sponsor edita criativos sozinho, o próximo gargalo operacional real é renovação/cobrança (hoje 100% manual via admin). Isso fecha o loop comercial: aquisição → entrega → ROI → autonomia → **renovação automatizada**. Maior impacto em receita recorrente e menor em complexidade que SEO Massivo ou Landing Factory.

---

## Arquivos a criar/editar

**Novos:**

- `supabase/migrations/<ts>_sponsor_change_requests.sql`
- `src/pages/sponsor/SponsorSelfServicePage.tsx`
- `src/pages/AdminSponsorChangeRequestsPage.tsx`
- `src/components/sponsors/SponsorAlertsCard.tsx`
- `src/components/sponsors/SponsorChangeRequestForm.tsx`
- `src/components/sponsors/SponsorChangeRequestList.tsx`
- `src/components/sponsors/AdminChangeRequestDiff.tsx`
- `src/lib/sponsorSelfService.ts` (whitelist constants + helpers + zod)
- `src/__tests__/sponsor-change-request-whitelist.test.ts`
- `src/__tests__/sponsor-change-request-ownership.test.ts`
- `.lovable/memory/funcionalidades/patrocinadores/self-service-fase-2-4.md`

**Editados:**

- `src/App.tsx` (rotas lazy)
- `src/components/AdminLayout.tsx` + `AdminGroupNav.tsx` (item "Solicitações sponsor")
- `src/pages/sponsor/SponsorDashboardPage.tsx` (alerts card + link editar)
- `.lovable/memory/index.md` (referência)

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

---

&nbsp;

ADITIVO A — IMMUTABLE SNAPSHOT NO REVIEW

&nbsp;

Problema: Hoje o sponsor pode editar novamente enquanto existe request pending/cancelled/rejected, e o admin pode aprovar olhando um estado já alterado visualmente.

&nbsp;

Adicionar em sponsor_change_requests:

&nbsp;

current_snapshot jsonb

&nbsp;

No submit:

&nbsp;

salvar snapshot atual do sponsor antes da mudança.

&nbsp;

&nbsp;

No diff admin:

&nbsp;

comparar:

&nbsp;

snapshot anterior

&nbsp;

proposed changes

&nbsp;

estado atual

&nbsp;

&nbsp;

&nbsp;

Resultado:

&nbsp;

evita race conditions operacionais

&nbsp;

evita aprovação baseada em estado já alterado

&nbsp;

melhora auditoria

&nbsp;

&nbsp;

Sem complexidade relevante.

&nbsp;

&nbsp;

---

&nbsp;

ADITIVO B — SINGLE PENDING REQUEST LOCK

&nbsp;

Hoje nada impede:

&nbsp;

8 requests pendentes simultâneas do mesmo sponsor.

&nbsp;

&nbsp;

Adicionar regra:

&nbsp;

UNIQUE pending per sponsor_id

WHERE status='pending'

&nbsp;

OU validar na RPC.

&nbsp;

Mensagem:

&nbsp;

> “Existe uma solicitação pendente aguardando revisão.”

&nbsp;

&nbsp;

&nbsp;

Resultado:

&nbsp;

evita spam operacional

&nbsp;

simplifica fila admin

&nbsp;

evita conflitos de merge manual

&nbsp;

&nbsp;

&nbsp;

---

&nbsp;

ADITIVO C — RATE LIMIT SELF-SERVICE

&nbsp;

Mesmo com ownership:

&nbsp;

sponsor pode floodar requests.

&nbsp;

&nbsp;

Adicionar debounce server-side:

&nbsp;

máximo 5 requests / 24h / sponsor

&nbsp;

&nbsp;

Via RPC:

&nbsp;

count(*) where created_at > now()-interval '24h'

&nbsp;

Sem Redis. Sem edge. Sem infra nova.

&nbsp;

&nbsp;

---

&nbsp;

ADITIVO D — ASSET ORPHAN CLEANUP

&nbsp;

Hoje:

&nbsp;

sponsor sobe banner

&nbsp;

cancela request

&nbsp;

asset fica órfão no bucket

&nbsp;

&nbsp;

Adicionar:

&nbsp;

storage_path

&nbsp;

em sponsor_change_requests.

&nbsp;

Quando:

&nbsp;

rejected

&nbsp;

cancelled

&nbsp;

expired draft

&nbsp;

&nbsp;

→ marcar asset como órfão em audit_log.

&nbsp;

NÃO deletar automático ainda.

&nbsp;

Resultado:

&nbsp;

prepara hygiene futura do bucket

&nbsp;

evita lixo infinito

&nbsp;

&nbsp;

&nbsp;

---

&nbsp;

ADITIVO E — REVIEW STATUS BADGES NO DASHBOARD SPONSOR

&nbsp;

No SponsorDashboard: mostrar:

&nbsp;

“Alteração aguardando aprovação”

&nbsp;

“Última alteração aprovada”

&nbsp;

“Última alteração rejeitada”

&nbsp;

&nbsp;

Sem abrir tela admin.

&nbsp;

Resultado:

&nbsp;

reduz suporte manual

&nbsp;

reduz tickets

&nbsp;

melhora UX operacional

&nbsp;

&nbsp;

&nbsp;

---

&nbsp;

ADITIVO F — AUDITORIA FINAL OBRIGATÓRIA

&nbsp;

Adicionar explicitamente no plano:

&nbsp;

Auditoria final obrigatória (READ-ONLY)

&nbsp;

Validar:

&nbsp;

sponsor NÃO consegue UPDATE direto em sponsors

&nbsp;

sponsor NÃO consegue aprovar request

&nbsp;

sponsor NÃO consegue editar sponsor_id alheio

&nbsp;

whitelist server-side realmente bloqueia campos sensíveis

&nbsp;

uploads órfãos identificáveis

&nbsp;

pending-lock funcionando

&nbsp;

rate-limit funcionando

&nbsp;

App.tsx lazy correto

&nbsp;

sem regressão no SponsorDashboard

&nbsp;

sem N+1 nas páginas novas

&nbsp;

bundle impact medido

&nbsp;

queries indexadas

&nbsp;

&nbsp;

E exigir:

&nbsp;

Tabela:

- arquivos criados

- arquivos alterados

- LOC adicionada

- novas RPCs

- novos índices

- impacto estimado bundle

- riscos restantes

- débitos aceitos conscientemente

&nbsp;

&nbsp;

---

&nbsp;

VEREDITO

&nbsp;

Sem os aditivos:

&nbsp;

já está operacional.

&nbsp;

&nbsp;

Com os aditivos:

&nbsp;

fica pronto para escalar sponsor self-service sem virar caos operacional em 3-6 meses.

&nbsp;

&nbsp;

Os aditivos A+B+C são os mais importantes.