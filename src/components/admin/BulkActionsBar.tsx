import { Trash2, RotateCcw, Download, X, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface BulkActionsBarProps {
  count: number;
  onClear: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onExport?: () => void;
  loading?: boolean;
  isTrash?: boolean;
  children?: React.ReactNode;
}

const BulkActionsBar = ({
  count,
  onClear,
  onDelete,
  onRestore,
  onExport,
  loading,
  isTrash,
  children,
}: BulkActionsBarProps) => {
  if (count === 0) return null;

  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 shadow-sm">
      <CheckSquare className="h-4 w-4 text-accent" />
      <span className="text-sm font-medium text-foreground">
        {count} selecionado(s)
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        {children}

        {onExport && (
          <Button size="sm" variant="outline" onClick={onExport} disabled={loading}>
            <Download className="mr-1 h-3.5 w-3.5" /> Exportar
          </Button>
        )}

        {isTrash && onRestore && (
          <Button size="sm" variant="outline" onClick={onRestore} disabled={loading} className="text-green-600 border-green-200">
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restaurar
          </Button>
        )}

        {onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={loading}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> {isTrash ? 'Excluir definitivo' : 'Lixeira'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar ação</AlertDialogTitle>
                <AlertDialogDescription>
                  {isTrash
                    ? `Excluir permanentemente ${count} item(ns)? Esta ação não pode ser desfeita.`
                    : `Mover ${count} item(ns) para a lixeira? Você poderá restaurá-los depois.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <Button size="sm" variant="ghost" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default BulkActionsBar;
