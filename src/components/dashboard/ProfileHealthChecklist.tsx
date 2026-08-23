import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@/lib/router-compat';
import { motion } from 'framer-motion';
import { Camera, FileText, Image as ImageIcon, ShieldCheck, Briefcase, Check, ChevronRight, ListChecks } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

interface CriterionStatus {
  key: string;
  icon: typeof Camera;
  label: string;
  description: string;
  weight: number;
  done: boolean;
  cta: string;
  to: string;
}

const ProfileHealthChecklist = () => {
  const { user, provider } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['profile-health-checklist', user?.id, provider?.id],
    enabled: !!user?.id && !!provider?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const [profileRes, providerRes] = await Promise.all([
        supabase.from('profiles').select('avatar_url, tax_id_last4').eq('id', user!.id).maybeSingle(),
        supabase
          .from('providers')
          .select('description, services_count, portfolio_photo_count, community_verified')
          .eq('user_id', user!.id)
          .maybeSingle(),
      ]);
      return {
        avatar_url: (profileRes.data as any)?.avatar_url ?? null,
        tax_id_last4: (profileRes.data as any)?.tax_id_last4 ?? null,
        description: (providerRes.data as any)?.description ?? '',
        services_count: Number((providerRes.data as any)?.services_count ?? 0),
        portfolio_photo_count: Number((providerRes.data as any)?.portfolio_photo_count ?? 0),
        community_verified: Boolean((providerRes.data as any)?.community_verified),
      };
    },
  });

  if (isLoading || !data) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }

  const criteria: CriterionStatus[] = [
    {
      key: 'photo',
      icon: Camera,
      label: 'Foto de perfil',
      description: 'Perfis com foto recebem até 7x mais cliques.',
      weight: 15,
      done: !!data.avatar_url,
      cta: 'Adicionar foto',
      to: '/dashboard/perfil',
    },
    {
      key: 'bio',
      icon: FileText,
      label: 'Bio preenchida',
      description: 'Mínimo de 200 caracteres. Convertem 3x mais.',
      weight: 20,
      done: (data.description?.length ?? 0) >= 200,
      cta: 'Escrever bio',
      to: '/dashboard/perfil',
    },
    {
      key: 'portfolio',
      icon: ImageIcon,
      label: '5+ fotos no portfólio',
      description: 'Portfólios visuais geram 5x mais confiança.',
      weight: 25,
      done: data.portfolio_photo_count >= 5,
      cta: 'Subir fotos',
      to: '/dashboard/portfolio',
    },
    {
      key: 'verification',
      icon: ShieldCheck,
      label: 'Verificação concluída',
      description: 'CPF/CNPJ cadastrado ou validação da comunidade.',
      weight: 25,
      done: !!data.tax_id_last4 || data.community_verified,
      cta: 'Verificar agora',
      to: '/dashboard/perfil',
    },
    {
      key: 'services',
      icon: Briefcase,
      label: '3+ serviços ativos',
      description: 'Aparece em mais buscas e atrai mais leads.',
      weight: 15,
      done: data.services_count >= 3,
      cta: 'Cadastrar serviço',
      to: '/dashboard/servicos',
    },
  ];

  const completed = criteria.filter((c) => c.done).length;
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const earnedWeight = criteria.filter((c) => c.done).reduce((s, c) => s + c.weight, 0);
  const pct = Math.round((earnedWeight / totalWeight) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <ListChecks className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-foreground">Próximos passos</h3>
            <p className="text-[11px] text-muted-foreground">
              {completed} de {criteria.length} concluídos · {pct}% de visibilidade
            </p>
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {criteria.map((c) => {
          const Icon = c.icon;
          return (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => navigate(c.to)}
                className={`group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                  c.done
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border bg-background hover:border-accent/40 hover:bg-accent/5'
                }`}
                aria-label={`${c.label}: ${c.done ? 'concluído' : 'pendente'}`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    c.done ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-accent/10 text-accent'
                  }`}
                >
                  {c.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{c.label}</p>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        c.done
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      +{c.weight}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{c.description}</p>
                  {!c.done && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                      {c.cta} <ChevronRight className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
};

export default ProfileHealthChecklist;
