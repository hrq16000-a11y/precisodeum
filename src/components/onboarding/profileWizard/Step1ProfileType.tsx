import { useState } from 'react';
import { Step1Identity } from '@/components/onboarding/SmartOnboardingWizard';

export type ProfileType = 'provider' | 'client' | 'rh' | 'sponsor';
export type ProviderSubtype = 'autonomous' | 'company';

interface Step1ProfileTypeProps {
  /** Tipo já existente no perfil — se houver, mostra "Continuar atualização". */
  existingProfileType: ProfileType | null;
  /** Selecionou um tipo (provider dispara escolha de subtipo PF/PJ). */
  onSelectType: (type: ProfileType, subtype?: ProviderSubtype) => void;
  /** Continuar atualização do perfil já existente. */
  onContinueProfileUpdate: () => void;
}

/**
 * Step 1 do ProfileWizard refatorado — seleção de tipo de perfil.
 *
 * Reusa o componente `Step1Identity` original do SmartOnboardingWizard
 * para garantir paridade visual e funcional 1:1 (mesmos botões, mesmos
 * tipos suportados). Adiciona o subfluxo PF/PJ quando 'provider' é escolhido.
 */
const Step1ProfileType = ({
  existingProfileType,
  onSelectType,
  onContinueProfileUpdate,
}: Step1ProfileTypeProps) => {
  const [pendingProvider, setPendingProvider] = useState(false);

  if (pendingProvider) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setPendingProvider(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Voltar
        </button>
        <h2 className="text-center font-display text-lg font-bold text-foreground">
          Você atua como…
        </h2>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => onSelectType('provider', 'autonomous')}
            className="rounded-2xl border-2 border-accent/30 bg-accent/5 p-4 text-left hover:border-accent transition-colors"
          >
            <p className="font-bold text-foreground">Profissional Autônomo (PF)</p>
            <p className="text-xs text-muted-foreground">Sem CNPJ obrigatório</p>
          </button>
          <button
            type="button"
            onClick={() => onSelectType('provider', 'company')}
            className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-left hover:border-primary transition-colors"
          >
            <p className="font-bold text-foreground">Empresa / MEI (PJ)</p>
            <p className="text-xs text-muted-foreground">Tenho CNPJ</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <Step1Identity
      existingProfileType={existingProfileType}
      onContinueProfileUpdate={onContinueProfileUpdate}
      onSelectType={(type) => {
        if (type === 'provider') {
          setPendingProvider(true);
          return;
        }
        onSelectType(type);
      }}
    />
  );
};

export default Step1ProfileType;
