/**
 * Prévia pública e estática do wizard de onboarding.
 *
 * Renderiza TODOS os passos (boas-vindas + 1 a 5) em sequência vertical,
 * usando os mesmos componentes visuais do `SmartOnboardingWizard`, mas com
 * dados mockados. Não requer autenticação, não escreve no banco e não
 * dispara nenhum efeito colateral. Útil para QA, screenshots, e revisão
 * de UX sem precisar criar conta de teste.
 *
 * Rota: `/triagem/preview` (publica, noindex).
 */
import { Sparkles, ArrowLeft } from 'lucide-react';
import {
  Step1Identity,
  Step2Location,
  Step3Contact,
  Step4Service,
  Step5Done,
} from '@/components/onboarding/SmartOnboardingWizard';
import { useSeoHead } from '@/hooks/useSeoHead';

const NOOP = () => {};
const NOOP_ASYNC = async () => {};

const SectionFrame = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="w-full">
    <header className="mx-auto mb-4 max-w-md px-4">
      <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
        Prévia
      </span>
      <h2 className="mt-2 font-display text-lg font-bold text-foreground">{title}</h2>
    </header>
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
      {children}
    </div>
  </section>
);

const WelcomePreview = () => (
  <div className="flex flex-col items-center justify-center gap-4 rounded-xl bg-gradient-to-br from-background via-background to-accent/5 px-6 py-12 text-center">
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg">
      <Sparkles className="h-8 w-8" />
    </div>
    <h1 className="font-display text-2xl font-bold text-foreground">Bem-vindo(a)!</h1>
    <p className="max-w-sm text-sm text-muted-foreground">
      Vamos completar seu perfil em 5 passos rápidos. Tudo é salvo automaticamente.
    </p>
  </div>
);

const TriagePreviewPage = () => {
  useSeoHead({
    title: 'Prévia do wizard de onboarding',
    description: 'Visualização estática dos 5 passos do cadastro progressivo.',
    noindex: true,
  });

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
          <a href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao site
          </a>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Modo prévia • sem persistência
          </span>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-md px-4 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Prévia do wizard de onboarding
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Visualização dos 5 passos + tela de boas-vindas. Nada é salvo no banco.
        </p>
      </div>

      <div className="mt-8 space-y-10">
        <SectionFrame title="Tela de boas-vindas (1.1s antes do Passo 1)">
          <WelcomePreview />
        </SectionFrame>

        <SectionFrame title="Passo 1 — Identidade (escolha do tipo de perfil)">
          <Step1Identity
            existingProfileType={null}
            onContinueProfileUpdate={NOOP}
            onSelectType={NOOP}
          />
        </SectionFrame>

        <SectionFrame title="Passo 2 — Localização e foto">
          <Step2Location
            city=""
            state=""
            avatarUrl={null}
            editingCity={true}
            onEditCity={NOOP}
            onCloseEditing={NOOP}
            onCityChange={NOOP}
            onAvatarChange={NOOP}
            onFieldBlur={NOOP}
            userId={undefined}
            onBack={NOOP}
            onNext={NOOP}
            onSkip={NOOP}
            canAdvance={false}
            fullName="Maria Silva"
            socialAvatarUrl={null}
          />
        </SectionFrame>

        <SectionFrame title="Passo 3 — Contato e documento">
          <Step3Contact
            profileType="provider"
            fullName="Maria Silva"
            setFullName={NOOP}
            agencyName=""
            setAgencyName={NOOP}
            whatsapp=""
            setWhatsapp={NOOP}
            bio=""
            setBio={NOOP}
            taxId=""
            setTaxId={NOOP}
            taxSavedFeedback={false}
            categoriesForPicker={[]}
            selectedCategoryIds={[]}
            onToggleCategory={NOOP}
            onFieldBlur={NOOP}
            saving={false}
            canAdvance={false}
            onBack={NOOP}
            onNext={NOOP}
            onSkip={NOOP}
          />
        </SectionFrame>

        <SectionFrame title="Passo 4 — Primeiro serviço (Hard Save)">
          <Step4Service
            providerReady={true}
            servicesCreated={1}
            portfolioAlbumsCreated={0}
            creatingAlbum={false}
            onCreateFirstAlbum={NOOP_ASYNC}
            savedProvider={{ id: 'preview-id' }}
            userId="preview-user"
            categories={[]}
            onServiceCreated={NOOP}
            onContinue={NOOP}
            onBack={NOOP}
            onSkip={NOOP}
          />
        </SectionFrame>

        <SectionFrame title="Passo 5 — Finalizar e publicar (CTA gigante)">
          <Step5Done
            profileType="provider"
            servicesCreated={1}
            saving={false}
            onFinish={NOOP}
            onBack={NOOP}
          />
        </SectionFrame>
      </div>
    </div>
  );
};

export default TriagePreviewPage;
