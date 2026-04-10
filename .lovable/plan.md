

## Auditoria: Onboarding vs Serviços

### Diagnóstico

| Item | Status |
|---|---|
| `ServiceWizard.tsx` existe | Sim, mas **nunca importado** — código morto |
| Fluxo de criação de serviço | Único: Dialog em `DashboardServicesPage` |
| Onboarding no Dashboard | Checklist manual (4 passos) que redireciona para páginas existentes |
| Wizard integrado ao onboarding | **Não** — o passo 2 do onboarding manda para `/dashboard/servicos` (Dialog) |

### Problemas identificados

1. **ServiceWizard é código morto** — documentado como "onboarding only" mas sem nenhum `import` em todo o projeto
2. **Onboarding não usa wizard** — o checklist do Dashboard redireciona diretamente para as páginas normais, sem fluxo guiado
3. **Passo 2 do onboarding ("Cadastre seus serviços")** manda para o mesmo Dialog de operação diária — não há diferenciação de experiência

### Plano

**Arquivo: `src/pages/DashboardPage.tsx`**
- Integrar `ServiceWizard` como modal no passo 2 do onboarding (quando `servicesCount === 0`)
- O CTA "Crie seu primeiro serviço!" abre o Wizard em vez de navegar para `/dashboard/servicos`
- Após conclusão do Wizard, marca `servicesDone = true` e fecha o modal
- Para profissionais com serviços existentes, o link do checklist continua apontando para `/dashboard/servicos`

**Arquivo: `src/components/dashboard/ServiceWizard.tsx`**
- Nenhuma alteração estrutural — já está pronto para uso
- Validar que `onComplete` e `onCancel` estão compatíveis com o uso como modal

**Separação clara:**

```text
┌─────────────────────────┐     ┌──────────────────────────┐
│   ONBOARDING (1ª vez)   │     │   OPERAÇÃO (dia a dia)   │
│                         │     │                          │
│  DashboardPage          │     │  DashboardServicesPage   │
│  └─ ServiceWizard       │     │  └─ Dialog inline        │
│     (modal guiado)      │     │     (criação rápida)     │
│                         │     │                          │
│  Quando: servicesCount=0│     │  Quando: sempre          │
│  Contexto: setup inicial│     │  Contexto: gestão        │
└─────────────────────────┘     └──────────────────────────┘
```

**Escopo total: 2 arquivos editados, 0 migrações SQL**

