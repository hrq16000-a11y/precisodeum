/**
 * Harness de teste de wizard — somente DEV, nunca exposto em produção.
 * Movido de src/routes/publicRoutes.tsx durante a migração TanStack Start.
 */
import ReportWizardErrorButton from "@/components/wizard/ReportWizardErrorButton";

export const WizardSupportTestHarness = () => {
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const code = search?.get('code') || 'phase2_photos:no_session';
  const city = search?.get('city') || 'Curitiba';
  const category = search?.get('category') || 'cat-eletricista';
  const mode = search?.get('mode') || 'no_session';
  const lastPersistError = {
    message: search?.get('message') || 'Serviço principal não encontrado após a persistência.',
    code: search?.get('lastCode') || 'PGRST116',
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <section className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
        <h1 className="text-base font-semibold">Algo travou no cadastro</h1>
        <p className="text-sm text-muted-foreground">
          O fallback de erro tomou o lugar da tela em branco e manteve o contexto real do problema.
        </p>
        <div data-testid="phase2-photos-blocked" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Código: <code className="font-mono">{code}</code></p>
          <p className="mt-1 text-muted-foreground">Modo: {mode}</p>
          <div className="mt-3 flex flex-col gap-2">
            <button type="button" className="h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
              {mode === 'no_session' ? 'Fazer login novamente' : 'Voltar e revisar o serviço'}
            </button>
            <button type="button" className="h-10 rounded-md border border-border px-4 text-sm font-medium">
              {mode === 'no_session' ? 'Pular fotos por enquanto' : 'Recuperar rascunho do serviço'}
            </button>
          </div>
        </div>
        <ReportWizardErrorButton
          step={code}
          componentName="WizardSupportTestHarness"
          label="Reportar para o suporte"
          contextSnapshot={{
            code,
            category,
            city,
            stage: mode,
            has_provider: mode !== 'no_session',
            has_first_service: false,
            lastPersistError,
          }}
        />
      </section>
    </main>
  );
};
