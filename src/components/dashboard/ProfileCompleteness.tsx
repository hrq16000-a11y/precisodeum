import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProfileCompletenessProps {
  provider: any;
  profile: any;
  servicesCount: number;
  portfolioCount?: number;
}

const ProfileCompleteness = ({ provider, profile, servicesCount, portfolioCount = 0 }: ProfileCompletenessProps) => {
  const checks = [
    { label: 'Nome completo', done: !!profile?.full_name && profile.full_name.trim().length > 2 },
    { label: 'Foto de perfil', done: !!profile?.avatar_url },
    { label: 'Descrição profissional', done: !!provider?.description && provider.description.length > 20 },
    { label: 'Cidade informada', done: !!provider?.city },
    { label: 'WhatsApp cadastrado', done: !!provider?.whatsapp },
    { label: 'Pelo menos 1 serviço', done: servicesCount > 0 },
    { label: 'Fotos no portfólio', done: portfolioCount > 0 },
    { label: 'Categoria definida', done: !!provider?.category_id },
  ];

  const doneCount = checks.filter(c => c.done).length;
  const percentage = Math.round((doneCount / checks.length) * 100);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          {percentage === 100 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
          Completude do Perfil
        </h3>
        <span className="text-sm font-bold text-foreground">{percentage}%</span>
      </div>
      <Progress value={percentage} className="h-2 mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-2 text-xs">
            {check.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            )}
            <span className={check.done ? 'text-muted-foreground' : 'text-foreground font-medium'}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileCompleteness;
