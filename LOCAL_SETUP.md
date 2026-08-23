# Rodando o portal 100% localmente (sem nuvem, sem internet)

Este guia deixa o projeto rodando por completo na sua máquina: banco de dados,
Auth, Storage, Edge Functions e o app TanStack Start.

---

## 1. Pré-requisitos

| Ferramenta   | Versão mínima | Observação                                   |
| ------------ | ------------- | -------------------------------------------- |
| Docker       | 24+           | Precisa estar rodando antes do `supabase start` |
| Supabase CLI | 2.x           | `npm i -g supabase` ou `brew install supabase/tap/supabase` |
| Node / Bun   | Node 20+      | `npm install` ou `bun install`                |

> Depois do primeiro `supabase start` as imagens ficam em cache no Docker,
> então as execuções seguintes funcionam **sem internet**.

---

## 2. Passo a passo

```bash
# 1) dependências do app
npm install

# 2) variáveis de ambiente locais
cp .env.local.example .env

# 3) sobe Postgres + Auth + Storage + Studio + Edge Runtime (Docker)
npm run db:start

# 4) aplica TODAS as migrations + supabase/seed.sql em um banco limpo
npm run db:reset

# 5) app + Edge Functions locais
npm run dev:local
```

Endereços padrão:

| Serviço            | URL                       |
| ------------------ | ------------------------- |
| App (TanStack)     | http://localhost:8080     |
| API Supabase       | http://127.0.0.1:54321    |
| Studio (admin DB)  | http://127.0.0.1:54323    |
| Inbucket (e-mails) | http://127.0.0.1:54324    |
| Postgres           | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

---

## 3. Scripts disponíveis

| Script                      | O que faz                                              |
| --------------------------- | ------------------------------------------------------ |
| `npm run dev:local`         | Sobe o Vite/TanStack já apontando para o Supabase local |
| `npm run db:start` / `db:stop` | Liga/desliga o stack Docker do Supabase              |
| `npm run db:reset`          | Recria o banco: migrations + `supabase/seed.sql`        |
| `npm run db:status`         | Mostra URLs e chaves geradas localmente                 |
| `npm run db:diff`           | Gera uma nova migration a partir de alterações no Studio |
| `npm run functions:serve`   | Serve todas as Edge Functions em http://127.0.0.1:54321/functions/v1 |
| `npm run functions:serve:one -- nome-da-funcao` | Serve apenas uma função        |

---

## 4. Dados de teste (seed)

`supabase/seed.sql` cria, de forma idempotente:

- usuário admin `admin@local.test` / senha `admin123` (com `user_roles.role = 'admin'`);
- usuário profissional `pro@local.test` / senha `pro123` com `providers` aprovado;
- `site_settings` mínimos para a home, busca e feature flags não quebrarem;
- categorias e uma cidade de exemplo.

Rode novamente com `npm run db:reset` sempre que quiser voltar ao estado limpo.

---

## 5. Serviços de terceiros offline

Sem internet, chamadas externas são **simuladas** (nunca travam):

| Serviço                       | Comportamento local                        |
| ----------------------------- | ------------------------------------------ |
| Resend (`send-email`)         | `console.log` + retorno `{ ok: true, mocked: true }`; e-mails reais do Auth caem no Inbucket |
| Google Search Console         | submissão de sitemap retorna 200 simulado  |
| IndexNow / Bing               | ping simulado                              |

Controle manual pela env `LOCAL_MOCK_EXTERNAL=true|false`.

---

## 6. Isolamento contra produção

- `.env` local usa `VITE_SUPABASE_URL=http://127.0.0.1:54321`.
- O app loga no console qual backend está em uso em modo dev
  (`src/lib/localEnv.ts` → `logSupabaseTarget()`), então é impossível
  apontar sem querer para produção sem perceber.
- Nunca commite `.env`; apenas `.env.example` e `.env.local.example`.

---

## 7. Problemas comuns

- **`supabase start` falha**: confirme que o Docker está aberto e que as portas
  54321-54324 estão livres.
- **Tela em branco / 42501**: rode `npm run db:reset` — provavelmente faltam
  GRANTs/policies de uma migration nova.
- **Login não funciona**: use os usuários do seed; cadastro por e-mail exige
  confirmação, que está desabilitada localmente (`enable_confirmations = false`).
