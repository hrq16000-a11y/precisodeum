/**
 * WizardLegalDisclaimer — Selo de não-intermediação fixo no wizard.
 *
 * Reforça que a plataforma é vitrine tecnológica e que o lead vai direto
 * para o WhatsApp/Telefone do prestador, sem intermediação no pagamento.
 */

import { Shield, MessageCircle } from 'lucide-react';

export const WizardLegalDisclaimer = ({ platformName = 'Preciso de um Profissional' }: { platformName?: string }) => (
  <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 text-[11px] text-muted-foreground leading-relaxed">
    <div className="flex items-start gap-2">
      <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
      <p>
        A <span className="font-semibold text-foreground">{platformName}</span> é uma ferramenta de tecnologia nacional.
        Você é o único responsável pela execução e garantia dos serviços acordados diretamente com seus clientes.
      </p>
    </div>
    <div className="flex items-start gap-2">
      <MessageCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600" />
      <p>
        Cada lead cai <span className="font-semibold text-foreground">diretamente no seu WhatsApp/telefone</span>.
        A plataforma não intermedia pagamentos.
      </p>
    </div>
  </div>
);

export default WizardLegalDisclaimer;
