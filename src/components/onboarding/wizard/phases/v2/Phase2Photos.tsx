/**
 * Phase2Photos — upload de até 5 fotos do 1º serviço (1 capa + 4 conteúdos).
 *
 * Etapa intermediária OPCIONAL entre a publicação do serviço e a celebração.
 * Reusa o componente já consagrado `ServiceImageUpload`, que cuida de:
 *  - Compressão + blur placeholder (compressImage)
 *  - Upload para Storage com identidade do usuário
 *  - Persistência em `service_images` + tabela `media` unificada
 *  - Reordenação (define qual é a capa via display_order = 0)
 */

import { ImageIcon, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ServiceImageUpload from '@/components/ServiceImageUpload';

interface Phase2PhotosProps {
  serviceId: string;
  userId: string;
  serviceName: string;
  onContinue: () => void;
  onSkip: () => void;
}

export const Phase2Photos = ({
  serviceId, userId, serviceName, onContinue, onSkip,
}: Phase2PhotosProps) => (
  <div className="space-y-5">
    <header className="text-center space-y-1">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
        <ImageIcon className="h-7 w-7 text-accent" />
      </div>
      <h1 className="font-display text-2xl font-bold text-foreground">Adicione fotos do serviço</h1>
      <p className="text-sm text-muted-foreground">
        Até <span className="font-medium text-foreground">5 imagens</span> — a primeira é a capa.
        Perfis com fotos recebem 3× mais contatos.
      </p>
    </header>

    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {serviceName || 'Seu serviço'}
      </p>
      <ServiceImageUpload serviceId={serviceId} userId={userId} />
    </div>

    <div className="flex gap-2 pt-2">
      <Button type="button" variant="ghost" onClick={onSkip} className="flex-1">
        Pular por enquanto
      </Button>
      <Button type="button" onClick={onContinue} className="flex-1">
        Concluir <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
    <p className="text-center text-[10px] text-muted-foreground">
      Você pode adicionar/trocar fotos depois pelo Dashboard.
    </p>
  </div>
);

export default Phase2Photos;
