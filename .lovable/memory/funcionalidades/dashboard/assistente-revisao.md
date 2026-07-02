---
name: Assistente de revisão do cadastro
description: Tela /dashboard/assistente lista todas as 19 fases do wizard com status (concluída/atual/pendente/marco), permite revisar fases editáveis e continuar de onde parou.
type: feature
---

`/dashboard/assistente` (DashboardAssistantPage) substitui o redirect direto do botão "Assistente" no Dashboard. Reusa `useAuth().{profile, provider}` + 1 query no primeiro `services` do provider; deriva status via helper público `isPhaseFullyCompleted` de `wizardMode.ts`.

Catálogo `PHASE_CATALOG` mapeia cada `UnifiedPhase` para `{title, description, section}`. `section ∈ OnboardingReviewSection` ('cadastro'|'servicos'|'dados'|'portfolio'|'url') ou `null` (somente leitura — celebrações, triagem identidade, main_action). Edição abre `/cadastro-inicial?mode=review&section=...&next=/dashboard/assistente` (contrato existente, ativa `WizardMode='edit_profile'` + `<EditModeSkipButton>`).

Status: `done` (campos ok), `current` (1ª pendente, só quando onboarding_completed=false), `pending`, `locked`. Marcos (`triage_celebration`, `main_celebration`) não contam na barra de progresso. CTA "Continuar de onde parei" abre a seção da fase `current` ou primeira seção em modo review se tudo concluído.
