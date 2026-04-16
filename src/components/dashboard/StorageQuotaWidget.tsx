import { useStorageQuota } from '@/hooks/useStorageQuota';
import { HardDrive } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const StorageQuotaWidget = () => {
  const { data: quota, isLoading } = useStorageQuota();

  if (isLoading || !quota) return null;

  const getColor = () => {
    if (quota.percentUsed >= 90) return 'text-destructive';
    if (quota.percentUsed >= 70) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Armazenamento</span>
      </div>
      <Progress value={Math.min(quota.percentUsed, 100)} className="h-2" />
      <div className="flex justify-between text-xs">
        <span className={getColor()}>
          {quota.usedMB.toFixed(1)} MB usado
        </span>
        <span className="text-muted-foreground">
          {quota.limitMB} MB total
        </span>
      </div>
      {quota.percentUsed >= 90 && (
        <p className="text-xs text-destructive">
          Armazenamento quase cheio. Considere remover arquivos antigos.
        </p>
      )}
    </div>
  );
};

export default StorageQuotaWidget;
