import { useState } from 'react';
import { useNavigate } from '@/lib/router-compat';
import { User, Briefcase, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { createSyncTracker, logSyncFailure, showPartialSyncError } from '@/lib/multiWriteSync';
import { buildProfileTypeSwitchOperation, logOperationBuildFailure } from '@/lib/operations';

const TYPES = [
  { value: 'client', label: 'Cliente', icon: User, color: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'provider', label: 'Profissional', icon: Briefcase, color: 'border-accent/40 bg-accent/10 text-accent' },
  { value: 'rh', label: 'Agência de RH / Recrutamento', icon: Building2, color: 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
];

const ProfileTypeSwitcher = () => {
  const { user, profile, refetchProfile } = useAuth();
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const currentType = profile?.profile_type || 'client';

  const handleSwitch = async (newType: string) => {
    if (!user || newType === currentType || switching) return;
    // FASE 1.6.8 — pre-atomic operation boundary (não executa nada; só valida).
    const op = buildProfileTypeSwitchOperation({
      userId: user.id, currentType, targetType: newType,
    });
    if (!op.ok) {
      await logOperationBuildFailure('profile_type_switcher', op as any, { target_type: newType });
      // noop_same_type já é tratado acima; outros códigos são raros aqui.
      return;
    }
    setSwitching(true);
    // FASE 1.6.3 — tracker multi-write (profile_type → providers row).
    // FASE 1.6.6 — ownership: ao virar provider, providers.phone/whatsapp
    // passa a ser dono canônico; profiles permanece mirror de compat.
    // Esta troca NÃO escreve campos de contato — apenas garante linha
    // providers existente. Writes de contato seguem em DashboardProfilePage.
    const sync = createSyncTracker();
    let errorCode: string | null = null;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ profile_type: newType, role: newType } as any)
        .eq('id', user.id);
      if (error) {
        errorCode = (error as any).code || 'profile_type_update_failed';
        sync.mark('profile_type', false);
        throw error;
      }
      sync.mark('profile_type', true);

      // If switching to provider, ensure provider record exists
      if (newType === 'provider') {
        try {
          const { data: existing } = await supabase
            .from('providers')
            .select('id')
            .eq('user_id', user.id)
            .limit(1);
          if (!existing || existing.length === 0) {
            const name = profile?.full_name || user.email?.split('@')[0] || 'profissional';
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const { error: insErr } = await supabase.from('providers').insert({
              user_id: user.id,
              slug,
              status: 'pending',
            });
            if (insErr) {
              errorCode = (insErr as any).code || 'provider_insert_failed';
              sync.mark('provider', false);
              // FASE 1.6.3 — partial fail: profile_type já mudou mas provider não foi criado.
              await logSyncFailure({
                action: 'profile_type_switch_sync_failed',
                source: 'profile_type_switcher',
                snapshot: sync.snapshot(),
                errorCode,
                extra: { target_type: newType },
              });
              showPartialSyncError(() => { void handleSwitch(newType); });
              await refetchProfile();
              return;
            }
          }
          sync.mark('provider', true);
        } catch (innerErr) {
          errorCode = (innerErr as any)?.code || 'provider_lookup_failed';
          sync.mark('provider', false);
          await logSyncFailure({
            action: 'profile_type_switch_sync_failed',
            source: 'profile_type_switcher',
            snapshot: sync.snapshot(),
            errorCode,
            extra: { target_type: newType },
          });
          showPartialSyncError(() => { void handleSwitch(newType); });
          await refetchProfile();
          return;
        }
      }

      await refetchProfile();
      const label = TYPES.find(t => t.value === newType)?.label;
      toast.success(`Conta alterada para ${label}`);

      // Redirect to the correct area immediately
      if (newType === 'client') {
        navigate('/dashboard', { replace: true });
      } else if (newType === 'rh') {
        navigate('/dashboard/vagas', { replace: true });
      } else {
        navigate('/dashboard/servicos', { replace: true });
      }
    } catch {
      if (sync.failedStep) {
        await logSyncFailure({
          action: 'profile_type_switch_sync_failed',
          source: 'profile_type_switcher',
          snapshot: sync.snapshot(),
          errorCode,
          extra: { target_type: newType },
        });
      }
      showPartialSyncError(() => { void handleSwitch(newType); });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-sm font-bold text-foreground mb-1">Tipo de Conta</h3>
      <p className="text-xs text-muted-foreground mb-3">Altere o tipo da sua conta a qualquer momento</p>
      <div className="flex flex-wrap gap-2">
        {TYPES.map(t => {
          const Icon = t.icon;
          const isActive = currentType === t.value;
          return (
            <button
              key={t.value}
              disabled={switching}
              onClick={() => handleSwitch(t.value)}
              className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                isActive ? t.color + ' shadow-xs' : 'border-border text-muted-foreground hover:border-muted-foreground/30'
              } ${switching ? 'opacity-50' : ''}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {isActive && <span className="ml-1">•</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProfileTypeSwitcher;
