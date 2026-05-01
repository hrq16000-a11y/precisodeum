import { ShieldAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface QualityBlockState {
  open: boolean;
  score: number;
  hits: number;
  reasons: string[];
}

interface Props {
  state: QualityBlockState;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: () => void;
}

/**
 * Kill-Switch modal: shown when an ad has score<50% or >3 leilão terms.
 * Extracted from DashboardServicesPage to reduce main bundle / parse cost.
 * Pure UI — no business logic changes.
 */
const QualityBlockModal = ({ state, onOpenChange, onAcknowledge }: Props) => {
  return (
    <AlertDialog open={state.open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Anúncio bloqueado pelo Padrão de Qualidade
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-1">
            <span className="block text-foreground">
              Para proteger a valorização da sua mão de obra, não permitimos anúncios com baixo
              score ou termos de leilão. Use o botão <strong>"Reescrever com Qualidade"</strong>{' '}
              para atingir o Padrão Ouro e ser aprovado.
            </span>
            <span className="block rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-foreground">
              <strong>Motivos detectados:</strong>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {state.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </span>
            <span className="block text-xs text-muted-foreground">
              Esta tentativa foi registrada na auditoria interna para acompanhamento.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onAcknowledge}>Entendi, vou melhorar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default QualityBlockModal;
